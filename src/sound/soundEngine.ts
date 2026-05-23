import type { SoundId } from './types'
import { SOUND_LEVELS } from './soundGains'

const DEDUP_MS = 30
/** Peak output at 100% SFX volume (+20% from 0.525). */
export const BASE_MASTER_GAIN = 0.63

let ctx: AudioContext | null = null
/** User SFX volume — after compressor. */
let master: GainNode | null = null
/** Pre-compressor mix bus; connect one-shots and continuous SFX here. */
let sfxBus: GainNode | null = null
let sfxCompressor: DynamicsCompressorNode | null = null
/** Per-play trim node; defaults to sfxBus when null. */
let sfxSink: GainNode | null = null
let musicGain: GainNode | null = null
let lastPlayAt = 0
const activeNodes: AudioScheduledSourceNode[] = []

function stopActiveNodes() {
  for (const node of activeNodes) {
    try {
      node.stop()
    } catch {
      // already stopped
    }
  }
  activeNodes.length = 0
}

function track(node: AudioScheduledSourceNode) {
  activeNodes.push(node)
  node.onended = () => {
    const i = activeNodes.indexOf(node)
    if (i >= 0) activeNodes.splice(i, 1)
  }
}

function sfxOut(): GainNode {
  return sfxSink ?? sfxBus!
}

function initSfxChain(context: AudioContext): void {
  sfxBus = context.createGain()
  sfxBus.gain.value = 1

  sfxCompressor = context.createDynamicsCompressor()
  sfxCompressor.threshold.value = -20
  sfxCompressor.knee.value = 10
  sfxCompressor.ratio.value = 2.8
  sfxCompressor.attack.value = 0.003
  sfxCompressor.release.value = 0.13

  master = context.createGain()
  master.gain.value = BASE_MASTER_GAIN

  sfxBus.connect(sfxCompressor)
  sfxCompressor.connect(master)
  master.connect(context.destination)
  sfxSink = sfxBus
}

export function ensureAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!Ctx) return null
      ctx = new Ctx()
      initSfxChain(ctx)
      musicGain = ctx.createGain()
      musicGain.gain.value = 0
      musicGain.connect(ctx.destination)
    }
    return ctx
  } catch {
    return null
  }
}

function at(t: number): number {
  return (ensureAudioContext()?.currentTime ?? 0) + t
}

function env(
  context: AudioContext,
  peak: number,
  attack: number,
  release: number,
  start: number,
): GainNode {
  const g = context.createGain()
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), start + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, start + attack + release)
  return g
}

function tone(
  context: AudioContext,
  freq: number,
  peak: number,
  attack: number,
  release: number,
  start: number,
  type: OscillatorType = 'sine',
): void {
  const osc = context.createOscillator()
  const g = env(context, peak, attack, release, start)
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  osc.connect(g)
  g.connect(sfxOut())
  osc.start(start)
  osc.stop(start + attack + release + 0.02)
  track(osc)
}

function noiseBurst(
  context: AudioContext,
  duration: number,
  peak: number,
  start: number,
  filterFreq?: number,
  filterQ = 0.7,
): void {
  const len = Math.max(1, Math.floor(context.sampleRate * duration))
  const buf = context.createBuffer(1, len, context.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  }
  const src = context.createBufferSource()
  src.buffer = buf
  const g = env(context, peak, 0.002, duration * 0.85, start)
  if (filterFreq) {
    const f = context.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = filterFreq
    f.Q.value = filterQ
    src.connect(f)
    f.connect(g)
  } else {
    src.connect(g)
  }
  g.connect(sfxOut())
  src.start(start)
  src.stop(start + duration + 0.02)
  track(src)
}

function sweep(
  context: AudioContext,
  fromHz: number,
  toHz: number,
  duration: number,
  peak: number,
  start: number,
): void {
  const len = Math.max(1, Math.floor(context.sampleRate * duration))
  const buf = context.createBuffer(1, len, context.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) {
    const t = i / len
    const f = fromHz + (toHz - fromHz) * t
    data[i] = Math.sin((2 * Math.PI * f * i) / context.sampleRate) * (1 - t * 0.92)
  }
  const src = context.createBufferSource()
  src.buffer = buf
  const g = env(context, peak, 0.004, duration * 0.7, start)
  const f = context.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.setValueAtTime(900, start)
  f.frequency.exponentialRampToValueAtTime(4200, start + duration * 0.55)
  src.connect(f)
  f.connect(g)
  g.connect(sfxOut())
  src.start(start)
  src.stop(start + duration + 0.02)
  track(src)
}

/** Soft ambient dissolve — bassy wind breath (Monument Valley / Nintendo delete). */
function ambientDissolve(
  context: AudioContext,
  t0: number,
  duration: number,
  peak: number,
  subHz: number,
  subEndMul: number,
  windLpStart: number,
  windLpEnd: number,
): void {
  const attack = 0.016
  const bus = context.createGain()
  bus.gain.setValueAtTime(0.0001, t0)
  bus.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + attack)
  bus.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  bus.connect(sfxOut())

  const sub = context.createOscillator()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(subHz, t0)
  sub.frequency.exponentialRampToValueAtTime(
    Math.max(subHz * subEndMul, 28),
    t0 + duration * 0.72,
  )
  const subMix = context.createGain()
  subMix.gain.value = 0.5
  sub.connect(subMix)
  subMix.connect(bus)
  sub.start(t0)
  sub.stop(t0 + duration + 0.04)
  track(sub)

  const body = context.createOscillator()
  body.type = 'triangle'
  body.frequency.setValueAtTime(subHz * 2.01, t0)
  body.frequency.exponentialRampToValueAtTime(
    Math.max(subHz * subEndMul * 2, 50),
    t0 + duration * 0.68,
  )
  const bodyMix = context.createGain()
  bodyMix.gain.value = 0.11
  body.connect(bodyMix)
  bodyMix.connect(bus)
  body.start(t0)
  body.stop(t0 + duration + 0.04)
  track(body)

  const len = Math.max(1, Math.floor(context.sampleRate * duration))
  const buf = context.createBuffer(1, len, context.sampleRate)
  const data = buf.getChannelData(0)
  let pink = 0
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1
    pink = pink * 0.94 + white * 0.06
    data[i] = pink * (1 - i / len)
  }
  const wind = context.createBufferSource()
  wind.buffer = buf
  const lp = context.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 0.35
  lp.frequency.setValueAtTime(windLpStart, t0)
  lp.frequency.exponentialRampToValueAtTime(Math.max(windLpEnd, 35), t0 + duration * 0.78)
  const windMix = context.createGain()
  windMix.gain.value = 0.36
  wind.connect(lp)
  lp.connect(windMix)
  windMix.connect(bus)
  wind.start(t0)
  wind.stop(t0 + duration + 0.04)
  track(wind)
}

/** Slow breathing pad — soft ambient layer for theme shifts. */
function createSoftStartBus(context: AudioContext, start: number): GainNode {
  const bus = context.createGain()
  bus.gain.setValueAtTime(0, start)
  bus.gain.linearRampToValueAtTime(1, start + 0.014)
  bus.connect(sfxOut())
  return bus
}

function ambientPad(
  context: AudioContext,
  freq: number,
  peak: number,
  attack: number,
  hold: number,
  release: number,
  start: number,
  opts?: {
    type?: OscillatorType
    driftTo?: number
    driftAt?: number
    detuneCents?: number
    filterHz?: number
    out?: GainNode
  },
): void {
  const type = opts?.type ?? 'sine'
  const end = start + attack + hold + release
  const dest = opts?.out ?? sfxOut()
  const osc = context.createOscillator()
  const width = context.createOscillator()
  const mix = context.createGain()
  mix.gain.value = 0.5

  const g = context.createGain()
  g.gain.setValueAtTime(0, start)
  g.gain.linearRampToValueAtTime(Math.max(peak * 0.004, 0.0001), start + 0.01)
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), start + attack)
  g.gain.setValueAtTime(Math.max(peak * 0.88, 0.0002), start + attack + hold)
  g.gain.exponentialRampToValueAtTime(0.0001, end)

  const lp = context.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = opts?.filterHz ?? freq * 3.2
  lp.Q.value = 0.25

  osc.type = type
  width.type = 'sine'
  osc.frequency.setValueAtTime(freq, start)
  width.frequency.setValueAtTime(freq, start)
  width.detune.value = opts?.detuneCents ?? 6

  if (opts?.driftTo !== undefined && opts?.driftAt !== undefined) {
    const target = Math.max(opts.driftTo, 40)
    osc.frequency.exponentialRampToValueAtTime(target, start + opts.driftAt)
    width.frequency.exponentialRampToValueAtTime(target * 1.001, start + opts.driftAt)
  }

  osc.connect(mix)
  width.connect(mix)
  mix.connect(lp)
  lp.connect(g)
  g.connect(dest)
  osc.start(start)
  width.start(start)
  osc.stop(end + 0.04)
  width.stop(end + 0.04)
  track(osc)
  track(width)
}

function themeAmbientToLight(context: AudioContext, t0: number): void {
  const bus = createSoftStartBus(context, t0)
  const out = { out: bus }
  ambientPad(context, 392, 0.032, 0.42, 0.18, 0.92, t0, {
    driftTo: 466,
    driftAt: 0.72,
    detuneCents: 4,
    filterHz: 2100,
    ...out,
  })
  ambientPad(context, 587, 0.017, 0.48, 0.14, 0.86, t0 + 0.08, {
    driftTo: 659,
    driftAt: 0.65,
    detuneCents: -3,
    filterHz: 2800,
    ...out,
  })
  ambientPad(context, 880, 0.009, 0.52, 0.1, 0.74, t0 + 0.14, {
    detuneCents: 2,
    filterHz: 3600,
    ...out,
  })
  ambientPad(context, 1174, 0.004, 0.55, 0.08, 0.82, t0 + 0.18, {
    detuneCents: 1,
    filterHz: 4200,
    ...out,
  })
}

function themeAmbientToDark(context: AudioContext, t0: number): void {
  const bus = createSoftStartBus(context, t0)
  const out = { out: bus }
  ambientPad(context, 349, 0.034, 0.38, 0.2, 0.98, t0, {
    driftTo: 294,
    driftAt: 0.74,
    detuneCents: -4,
    filterHz: 780,
    ...out,
  })
  ambientPad(context, 247, 0.018, 0.44, 0.16, 0.88, t0 + 0.07, {
    driftTo: 208,
    driftAt: 0.66,
    detuneCents: 3,
    filterHz: 540,
    ...out,
  })
  ambientPad(context, 175, 0.01, 0.5, 0.12, 0.8, t0 + 0.13, {
    filterHz: 420,
    ...out,
  })
  ambientPad(context, 131, 0.0045, 0.54, 0.1, 0.86, t0 + 0.17, {
    filterHz: 360,
    detuneCents: -2,
    ...out,
  })
}

/** Airy low breath — flyout row hover (deeper/softer than panel open thump). */
function submenuHoverTick(context: AudioContext, t0: number): void {
  const root = 172
  tone(context, root * 0.52, 0.026, 0.014, 0.15, t0, 'sine')
  tone(context, root, 0.02, 0.012, 0.13, t0 + 0.01, 'sine')
  sweep(context, root * 0.78, root * 1.22, 0.11, 0.022, t0 + 0.008)
  noiseBurst(context, 0.09, 0.011, t0 + 0.018, 480, 0.32)
}

/** Single Wii-style icon blip — one tone, soft pitch glide, no stacked pops. */
function chromeIconBlip(
  context: AudioContext,
  t0: number,
  fromHz: number,
  toHz: number,
  peak: number,
  release: number,
): void {
  const osc = context.createOscillator()
  const g = env(context, peak, 0.0025, release, t0)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(fromHz, t0)
  osc.frequency.exponentialRampToValueAtTime(Math.max(toHz, 40), t0 + release * 0.34)
  osc.connect(g)
  g.connect(sfxOut())
  osc.start(t0)
  osc.stop(t0 + release + 0.025)
  track(osc)
}

/** Tactile canvas knock — warm filtered tap, distinct from chrome UI blips. */
function canvasObjectTap(
  context: AudioContext,
  t0: number,
  freq: number,
  peak: number,
  release: number,
  opts?: {
    startMul?: number
    endMul?: number
    filterStart?: number
    filterEnd?: number
  },
): void {
  const startMul = opts?.startMul ?? 1.12
  const endMul = opts?.endMul ?? 0.92
  const filterStart = opts?.filterStart ?? freq * 3.5
  const filterEnd = opts?.filterEnd ?? freq * 1.8

  const osc = context.createOscillator()
  const g = env(context, peak, 0.001, release, t0)
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq * startMul, t0)
  osc.frequency.exponentialRampToValueAtTime(Math.max(freq * endMul, 40), t0 + release * 0.28)

  const lp = context.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(filterStart, t0)
  lp.frequency.exponentialRampToValueAtTime(Math.max(filterEnd, 80), t0 + release * 0.55)
  lp.Q.value = 0.6

  osc.connect(lp)
  lp.connect(g)
  g.connect(sfxOut())
  osc.start(t0)
  osc.stop(t0 + release + 0.02)
  track(osc)
}

/** Flyout / menu row tap — quick icon confirm. */
function submenuTapTick(context: AudioContext, t0: number): void {
  chromeIconBlip(context, t0, 548, 592, 0.018, 0.072)
}

/** Chrome panel open — gentle upward icon select. */
function menuOpenTick(context: AudioContext, t0: number): void {
  chromeIconBlip(context, t0, 492, 648, 0.022, 0.095)
}

/** Chrome panel close — gentle downward icon release. */
function menuCloseTick(context: AudioContext, t0: number): void {
  chromeIconBlip(context, t0, 608, 488, 0.019, 0.085)
}

/** Soft upward lift — layer brought to front. */
function zOrderFrontTick(context: AudioContext, t0: number): void {
  const root = 248
  tone(context, root * 0.62, 0.018, 0.008, 0.07, t0, 'sine')
  sweep(context, root * 0.88, root * 1.42, 0.09, 0.022, t0 + 0.004)
  bubblyPluck(context, 392, 0.016, t0 + 0.038, 0.052)
}

/** Soft downward settle — layer sent to back. */
function zOrderBackTick(context: AudioContext, t0: number): void {
  const root = 292
  tone(context, root * 0.72, 0.017, 0.008, 0.07, t0, 'sine')
  sweep(context, root * 1.08, root * 0.72, 0.09, 0.022, t0 + 0.004)
  bubblyPluck(context, 330, 0.015, t0 + 0.038, 0.05, { startMul: 1.02, endMul: 0.94 })
}

/** Soft lift — canvas item grab (low-mid body, not a bright high tick). */
function itemGrabLift(context: AudioContext, t0: number): void {
  const root = 272
  tone(context, root * 0.6, 0.018, 0.006, 0.065, t0, 'sine')
  tone(context, root, 0.026, 0.005, 0.055, t0 + 0.007, 'sine')
  sweep(context, root * 0.9, root * 1.55, 0.09, 0.022, t0 + 0.006)
  noiseBurst(context, 0.065, 0.01, t0 + 0.012, 440, 0.38)
}

/** Bouncy pluck with a soft pitch settle — Animal Crossing–ish bubble pop. */
function bubblyPluck(
  context: AudioContext,
  freq: number,
  peak: number,
  start: number,
  release: number,
  opts?: { startMul?: number; endMul?: number },
): void {
  const startMul = opts?.startMul ?? 1.05
  const endMul = opts?.endMul ?? 1
  const osc = context.createOscillator()
  const g = env(context, peak, 0.002, release, start)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq * startMul, start)
  osc.frequency.exponentialRampToValueAtTime(
    Math.max(freq * endMul, 40),
    start + 0.024,
  )
  osc.connect(g)
  g.connect(sfxOut())
  osc.start(start)
  osc.stop(start + release + 0.03)
  track(osc)
}

/** Canvas object selected — warm card knock. */
function itemSelectTick(context: AudioContext, t0: number): void {
  canvasObjectTap(context, t0, 348, 0.019, 0.088)
}

/** Canvas selection cleared — soft release knock. */
function itemDeselectTick(context: AudioContext, t0: number): void {
  canvasObjectTap(context, t0, 312, 0.015, 0.095, { startMul: 1.06, endMul: 0.88 })
}

/** Clear temporary annotations — deeper, longer wind exhale. */
function clearAnnotationsTick(context: AudioContext, t0: number): void {
  ambientDissolve(context, t0, 0.36, 0.042, 68, 0.76, 380, 65)
}

/** Social profile peek — soft hello arpeggio (no space-style sweep). */
function profileOpenTick(context: AudioContext, t0: number): void {
  const mix = context.createGain()
  mix.gain.value = 0.72
  mix.connect(sfxOut())
  const prevSink = sfxSink
  sfxSink = mix
  try {
    tone(context, 392, 0.008, 0.014, 0.085, t0, 'sine')
    bubblyPluck(context, 523, 0.01, t0 + 0.024, 0.048)
    bubblyPluck(context, 659, 0.009, t0 + 0.05, 0.046)
    bubblyPluck(context, 784, 0.008, t0 + 0.076, 0.048)
  } finally {
    sfxSink = prevSink
  }
}

/** Social profile dismiss — muted pop with warm fade (not a space drop). */
function profileCloseTick(context: AudioContext, t0: number): void {
  tone(context, 466, 0.009, 0.004, 0.075, t0, 'sine')
  bubblyPluck(context, 554, 0.012, t0 + 0.006, 0.072, { startMul: 1.03, endMul: 0.86 })
  tone(context, 370, 0.006, 0.007, 0.13, t0 + 0.045, 'sine')
  tone(context, 310, 0.004, 0.009, 0.15, t0 + 0.07, 'sine')
  noiseBurst(context, 0.016, 0.0015, t0 + 0.018, 680, 0.22)
}

const PLAYERS: Record<SoundId, (context: AudioContext, t0: number) => void> = {
  itemGrab(context, t0) {
    itemGrabLift(context, t0)
  },

  itemSelect(context, t0) {
    itemSelectTick(context, t0)
  },

  itemDeselect(context, t0) {
    itemDeselectTick(context, t0)
  },

  itemDrop(context, t0) {
    tone(context, 95, 0.22, 0.003, 0.09, t0)
    noiseBurst(context, 0.05, 0.06, t0 + 0.002, 180, 0.5)
  },

  spawn(context, t0) {
    sweep(context, 220, 680, 0.11, 0.1, t0)
    tone(context, 520, 0.08, 0.002, 0.04, t0 + 0.1)
  },

  lock(context, t0) {
    tone(context, 180, 0.2, 0.001, 0.05, t0)
    tone(context, 540, 0.06, 0.001, 0.035, t0 + 0.004, 'triangle')
  },

  unlock(context, t0) {
    tone(context, 260, 0.16, 0.001, 0.045, t0)
    tone(context, 780, 0.07, 0.001, 0.03, t0 + 0.006, 'triangle')
  },

  spaceEnter(context, t0) {
    sweep(context, 280, 920, 0.2, 0.11, t0)
  },

  spaceExit(context, t0) {
    sweep(context, 880, 260, 0.2, 0.11, t0)
  },

  profileOpen(context, t0) {
    profileOpenTick(context, t0)
  },

  profileClose(context, t0) {
    profileCloseTick(context, t0)
  },

  menuOpen(context, t0) {
    menuOpenTick(context, t0)
  },

  menuClose(context, t0) {
    menuCloseTick(context, t0)
  },

  submenuHover(context, t0) {
    submenuHoverTick(context, t0)
  },

  submenuTap(context, t0) {
    submenuTapTick(context, t0)
  },

  undo(context, t0) {
    tone(context, 880, 0.09, 0.001, 0.025, t0)
    tone(context, 620, 0.07, 0.001, 0.028, t0 + 0.045)
  },

  redo(context, t0) {
    tone(context, 620, 0.07, 0.001, 0.025, t0)
    tone(context, 880, 0.09, 0.001, 0.028, t0 + 0.045)
  },

  clearAnnotations(context, t0) {
    clearAnnotationsTick(context, t0)
  },

  modalOpen(context, t0) {
    tone(context, 660, 0.1, 0.004, 0.14, t0)
    tone(context, 990, 0.05, 0.004, 0.12, t0 + 0.02, 'sine')
  },

  themeToLight(context, t0) {
    themeAmbientToLight(context, t0)
  },

  themeToDark(context, t0) {
    themeAmbientToDark(context, t0)
  },

  zOrderFront(context, t0) {
    zOrderFrontTick(context, t0)
  },

  zOrderBack(context, t0) {
    zOrderBackTick(context, t0)
  },
}

export async function resumeAudioContext(): Promise<void> {
  const context = ensureAudioContext()
  if (!context) return
  if (context.state === 'suspended') {
    await context.resume().catch(() => undefined)
  }
}

export function setMasterOutputGain(gain: number): void {
  if (!master || !ctx) return
  master.gain.setValueAtTime(Math.max(0, gain), ctx.currentTime)
}

/** Ramp music bus — audio plays at leg gain 1; intro lives here. */
export function rampMusicOutputGain(
  from: number,
  to: number,
  durationSec: number,
): void {
  const context = ensureAudioContext()
  if (!context || !musicGain) return
  const now = context.currentTime
  musicGain.gain.cancelScheduledValues(now)
  musicGain.gain.setValueAtTime(Math.max(0, from), now)
  musicGain.gain.linearRampToValueAtTime(Math.max(0, to), now + durationSec)
}

export function setMusicOutputGainImmediate(gain: number): void {
  if (!musicGain || !ctx) return
  musicGain.gain.cancelScheduledValues(ctx.currentTime)
  musicGain.gain.setValueAtTime(Math.max(0, gain), ctx.currentTime)
}

export function getMusicGainNode(): GainNode | null {
  ensureAudioContext()
  return musicGain
}

export function getSfxMasterGainNode(): GainNode | null {
  ensureAudioContext()
  return sfxBus
}

function runSound(id: SoundId, context: AudioContext, t0: number): void {
  const level = SOUND_LEVELS[id]
  const playGain = context.createGain()
  playGain.gain.value = level
  playGain.connect(sfxBus!)

  const prevSink = sfxSink
  sfxSink = playGain
  try {
    PLAYERS[id](context, t0)
  } finally {
    sfxSink = prevSink
  }
}

export function playSoundEngine(
  id: SoundId,
  opts?: { layer?: boolean },
): void {
  const context = ensureAudioContext()
  if (!context || !sfxBus) return
  resumeAudioContext()

  const now = performance.now()
  if (opts?.layer) {
    if (now - lastPlayAt >= DEDUP_MS) lastPlayAt = now
    runSound(id, context, at(0))
    return
  }

  if (now - lastPlayAt < DEDUP_MS) {
    stopActiveNodes()
  }
  lastPlayAt = now

  runSound(id, context, at(0))
}

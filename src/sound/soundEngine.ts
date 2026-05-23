import type { SoundId } from './types'

const DEDUP_MS = 30
/** Peak output at 100% SFX volume. */
export const BASE_MASTER_GAIN = 0.525

let ctx: AudioContext | null = null
let master: GainNode | null = null
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
      master = ctx.createGain()
      master.connect(ctx.destination)
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
  g.connect(master!)
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
  g.connect(master!)
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
  g.connect(master!)
  src.start(start)
  src.stop(start + duration + 0.02)
  track(src)
}

/** Layered sine + shimmer noise — theme toggle only. */
function glowLayer(
  context: AudioContext,
  freq: number,
  peak: number,
  attack: number,
  release: number,
  start: number,
  harmonic = 2,
  harmonicGain = 0.35,
): void {
  const osc = context.createOscillator()
  const harm = context.createOscillator()
  const mix = context.createGain()
  mix.gain.value = 1
  const g = env(context, peak, attack, release, start)
  osc.type = 'sine'
  harm.type = 'triangle'
  osc.frequency.setValueAtTime(freq, start)
  harm.frequency.setValueAtTime(freq * harmonic, start)
  const harmGain = context.createGain()
  harmGain.gain.value = harmonicGain
  osc.connect(mix)
  harm.connect(harmGain)
  harmGain.connect(mix)
  mix.connect(g)
  g.connect(master!)
  osc.start(start)
  harm.start(start)
  osc.stop(start + attack + release + 0.04)
  harm.stop(start + attack + release + 0.04)
  track(osc)
  track(harm)
}

function themeGlowToLight(context: AudioContext, t0: number): void {
  sweep(context, 360, 1280, 0.13, 0.065, t0)
  glowLayer(context, 523, 0.058, 0.014, 0.2, t0)
  glowLayer(context, 784, 0.038, 0.01, 0.22, t0 + 0.032, 2.01, 0.28)
  glowLayer(context, 1047, 0.024, 0.008, 0.18, t0 + 0.058, 2, 0.22)
  noiseBurst(context, 0.16, 0.048, t0 + 0.02, 2800, 1.3)
  noiseBurst(context, 0.2, 0.026, t0 + 0.07, 4800, 0.55)
}

function themeGlowToDark(context: AudioContext, t0: number): void {
  sweep(context, 960, 300, 0.14, 0.07, t0)
  glowLayer(context, 466, 0.052, 0.016, 0.24, t0)
  glowLayer(context, 349, 0.04, 0.012, 0.26, t0 + 0.034, 2, 0.3)
  glowLayer(context, 233, 0.028, 0.01, 0.28, t0 + 0.062, 1.5, 0.25)
  noiseBurst(context, 0.18, 0.042, t0 + 0.018, 720, 1)
  noiseBurst(context, 0.14, 0.022, t0 + 0.085, 1600, 0.65)
}

/** Low, woody menu tap — shared palette for open/close. */
function menuThump(
  context: AudioContext,
  t0: number,
  rootHz: number,
  bodyPeak: number,
  release: number,
): void {
  tone(context, rootHz * 0.62, bodyPeak * 0.55, 0.004, release * 1.05, t0, 'sine')
  tone(context, rootHz, bodyPeak, 0.003, release, t0, 'sine')
  tone(context, rootHz * 2.1, bodyPeak * 0.18, 0.002, release * 0.5, t0 + 0.004, 'triangle')
  noiseBurst(context, 0.042, bodyPeak * 0.42, t0 + 0.005, rootHz * 1.6, 0.5)
}

const PLAYERS: Record<SoundId, (context: AudioContext, t0: number) => void> = {
  itemGrab(context, t0) {
    tone(context, 3200, 0.04, 0.001, 0.012, t0, 'sine')
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

  menuOpen(context, t0) {
    menuThump(context, t0, 152, 0.13, 0.062)
  },

  menuClose(context, t0) {
    menuThump(context, t0, 138, 0.1, 0.052)
  },

  undo(context, t0) {
    tone(context, 880, 0.09, 0.001, 0.025, t0)
    tone(context, 620, 0.07, 0.001, 0.028, t0 + 0.045)
  },

  redo(context, t0) {
    tone(context, 620, 0.07, 0.001, 0.025, t0)
    tone(context, 880, 0.09, 0.001, 0.028, t0 + 0.045)
  },

  delete(context, t0) {
    sweep(context, 640, 140, 0.09, 0.12, t0)
  },

  modalOpen(context, t0) {
    tone(context, 660, 0.1, 0.004, 0.14, t0)
    tone(context, 990, 0.05, 0.004, 0.12, t0 + 0.02, 'sine')
  },

  themeToLight(context, t0) {
    themeGlowToLight(context, t0)
  },

  themeToDark(context, t0) {
    themeGlowToDark(context, t0)
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

export function playSoundEngine(id: SoundId): void {
  const context = ensureAudioContext()
  if (!context || !master) return
  resumeAudioContext()

  const now = performance.now()
  if (now - lastPlayAt < DEDUP_MS) {
    stopActiveNodes()
  }
  lastPlayAt = now

  const t0 = at(0)
  PLAYERS[id](context, t0)
}

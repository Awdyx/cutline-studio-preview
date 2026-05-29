import {
  ensureAudioContext,
  getSfxMasterGainNode,
  resumeAudioContext,
  setMasterOutputGain,
} from './soundEngine'
import { SFX_ON_GAIN } from './soundLevels'
import { RESIZE_SFX_LEVEL } from './soundGains'
import { useSoundStore } from './soundStore'

/**
 * Resize bed — deliberately *tonal* (a warm triangle + sub-octave sine through a
 * low-pass) so it reads differently from the noise "scrape" of dragging. The
 * pitch tracks how big/small the item is: growing it pulls the tone down, while
 * shrinking it lifts the tone up. Movement speed drives the loudness.
 */
const SPEED_MAX_PX = 1200
const MIN_SPEED_PX = 8
/** Audible idle so the held handle hums the current-size pitch even when still. */
const GAIN_IDLE = 0.006 * RESIZE_SFX_LEVEL
const GAIN_MAX = 0.052 * RESIZE_SFX_LEVEL

/** Pitch at the item's starting size; scaling moves it within the clamp range. */
const BASE_FREQ = 150
const FREQ_LOW = 70
const FREQ_HIGH = 138
/** How strongly size shifts pitch (per the size ratio, log-ish via pow). */
const PITCH_SLOPE = 0.65

const RAMP_SEC = 0.05
const SPEED_SMOOTHING = 0.76
/** Hold-still detection: after this gap with no real movement, the bed fades out. */
const IDLE_GRACE_MS = 90
/** Gentle fade to silence once the handle is held in place. */
const FADE_OUT_SEC = 0.85

type ResizeNodes = {
  osc: OscillatorNode
  sub: OscillatorNode
  lowpass: BiquadFilterNode
  gain: GainNode
}

let nodes: ResizeNodes | null = null
let lastClientX = 0
let lastClientY = 0
let lastSpeedSampleAt = 0
let smoothedSpeed = 0
let currentRatio = 1
let idleTimer: number | null = null

function canPlay(): boolean {
  const { muted, hydrated } = useSoundStore.getState()
  return hydrated && !muted
}

function clearIdleTimer() {
  if (idleTimer !== null) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
}

function resetMotionTracking(clientX?: number, clientY?: number) {
  lastClientX = clientX ?? 0
  lastClientY = clientY ?? 0
  lastSpeedSampleAt = clientX != null ? performance.now() : 0
  smoothedSpeed = 0
  currentRatio = 1
}

/** Re-arm the hold-still fade; fires only if no further movement arrives. */
function armIdleFade() {
  clearIdleTimer()
  idleTimer = window.setTimeout(() => {
    idleTimer = null
    const context = ensureAudioContext()
    if (!context || !nodes) return
    const when = context.currentTime
    nodes.gain.gain.cancelScheduledValues(when)
    nodes.gain.gain.setValueAtTime(nodes.gain.gain.value, when)
    nodes.gain.gain.setTargetAtTime(0.0001, when, FADE_OUT_SEC / 5)
  }, IDLE_GRACE_MS)
}

function speedToGain(speed: number): number {
  if (speed < MIN_SPEED_PX) return GAIN_IDLE
  const t = Math.min(1, (speed - MIN_SPEED_PX) / (SPEED_MAX_PX - MIN_SPEED_PX))
  return GAIN_IDLE + t * (GAIN_MAX - GAIN_IDLE)
}

function sizeToFreq(ratio: number): number {
  const r = Math.min(5, Math.max(0.2, ratio))
  const f = BASE_FREQ * Math.pow(r, -PITCH_SLOPE)
  return Math.min(FREQ_HIGH, Math.max(FREQ_LOW, f))
}

function applyMotion(speed: number, when: number) {
  if (!nodes) return

  smoothedSpeed = smoothedSpeed * SPEED_SMOOTHING + speed * (1 - SPEED_SMOOTHING)
  const gain = speedToGain(smoothedSpeed)
  const freq = sizeToFreq(currentRatio)

  nodes.gain.gain.cancelScheduledValues(when)
  nodes.gain.gain.setValueAtTime(nodes.gain.gain.value, when)
  nodes.gain.gain.linearRampToValueAtTime(gain, when + RAMP_SEC)

  nodes.osc.frequency.cancelScheduledValues(when)
  nodes.osc.frequency.setValueAtTime(nodes.osc.frequency.value, when)
  nodes.osc.frequency.linearRampToValueAtTime(freq, when + RAMP_SEC)

  nodes.sub.frequency.cancelScheduledValues(when)
  nodes.sub.frequency.setValueAtTime(nodes.sub.frequency.value, when)
  nodes.sub.frequency.linearRampToValueAtTime(freq / 2, when + RAMP_SEC)

  nodes.lowpass.frequency.cancelScheduledValues(when)
  nodes.lowpass.frequency.setValueAtTime(nodes.lowpass.frequency.value, when)
  nodes.lowpass.frequency.linearRampToValueAtTime(
    Math.min(2400, freq * 4),
    when + RAMP_SEC,
  )
}

export function startItemResizeSound(clientX?: number, clientY?: number): void {
  void startItemResizeSoundAsync(clientX, clientY)
}

async function startItemResizeSoundAsync(
  clientX?: number,
  clientY?: number,
): Promise<void> {
  if (!canPlay()) return

  stopItemResizeSound()

  const context = ensureAudioContext()
  const master = getSfxMasterGainNode()
  if (!context || !master) return

  await resumeAudioContext()
  setMasterOutputGain(SFX_ON_GAIN)

  const osc = context.createOscillator()
  osc.type = 'triangle'
  osc.frequency.value = BASE_FREQ

  const sub = context.createOscillator()
  sub.type = 'sine'
  sub.frequency.value = BASE_FREQ / 2

  const subGain = context.createGain()
  subGain.gain.value = 0.5

  const lowpass = context.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.Q.value = 0.6
  lowpass.frequency.value = BASE_FREQ * 4

  const gain = context.createGain()
  gain.gain.value = GAIN_IDLE

  osc.connect(lowpass)
  sub.connect(subGain)
  subGain.connect(lowpass)
  lowpass.connect(gain)
  gain.connect(master)

  const when = context.currentTime
  osc.start(when)
  sub.start(when)
  nodes = { osc, sub, lowpass, gain }
  resetMotionTracking(clientX, clientY)
  armIdleFade()
}

export function updateItemResizeSound(
  clientX: number,
  clientY: number,
  sizeRatio?: number,
): void {
  if (!nodes) return

  const context = ensureAudioContext()
  if (!context) return

  if (sizeRatio != null && Number.isFinite(sizeRatio) && sizeRatio > 0) {
    currentRatio = sizeRatio
  }

  const now = performance.now()
  if (lastSpeedSampleAt === 0) {
    lastClientX = clientX
    lastClientY = clientY
    lastSpeedSampleAt = now
    return
  }

  const dt = (now - lastSpeedSampleAt) / 1000
  if (dt < 0.01) return

  const dist = Math.hypot(clientX - lastClientX, clientY - lastClientY)

  lastClientX = clientX
  lastClientY = clientY
  lastSpeedSampleAt = now

  if (dist <= 1) return

  armIdleFade()
  applyMotion(dist / dt, context.currentTime)
}

export function stopItemResizeSound(): void {
  const context = ensureAudioContext()
  const active = nodes
  nodes = null
  clearIdleTimer()
  resetMotionTracking()

  if (!active || !context) return

  const when = context.currentTime
  active.gain.gain.cancelScheduledValues(when)
  active.gain.gain.setValueAtTime(Math.max(active.gain.gain.value, 0.0001), when)
  active.gain.gain.setTargetAtTime(0.0001, when, FADE_OUT_SEC / 5)

  try {
    active.osc.stop(when + FADE_OUT_SEC + 0.15)
    active.sub.stop(when + FADE_OUT_SEC + 0.15)
  } catch {
    // already stopped
  }
}

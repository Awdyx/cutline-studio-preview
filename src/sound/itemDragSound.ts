import {
  ensureAudioContext,
  getSfxMasterGainNode,
  resumeAudioContext,
  setMasterOutputGain,
} from './soundEngine'
import { SFX_ON_GAIN } from './soundLevels'
import { CONTINUOUS_SFX_LEVEL } from './soundGains'
import { useSoundStore } from './soundStore'

const SPEED_MAX_PX = 4200
const MIN_SPEED_PX = 20
const GAIN_MIN = 0.001872 * CONTINUOUS_SFX_LEVEL
const GAIN_MAX = 0.03744 * CONTINUOUS_SFX_LEVEL
const FREQ_MIN = 300
const FREQ_MAX = 720
const RAMP_SEC = 0.05
const SPEED_SMOOTHING = 0.75
/** Hold-still detection: after this gap with no real movement, the bed fades out. */
const IDLE_GRACE_MS = 90
/** Gentle fade to silence once the item is held in place. */
const FADE_OUT_SEC = 0.85

type DragNodes = {
  source: AudioBufferSourceNode
  filter: BiquadFilterNode
  gain: GainNode
}

let nodes: DragNodes | null = null
let noiseBuffer: AudioBuffer | null = null
let lastClientX = 0
let lastClientY = 0
let lastSpeedSampleAt = 0
let smoothedSpeed = 0
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

function resetMotionTracking() {
  lastClientX = 0
  lastClientY = 0
  lastSpeedSampleAt = 0
  smoothedSpeed = 0
}

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

function getNoiseBuffer(context: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === context.sampleRate) return noiseBuffer

  const duration = 0.32
  const len = Math.floor(context.sampleRate * duration)
  const buf = context.createBuffer(1, len, context.sampleRate)
  const data = buf.getChannelData(0)
  let pink = 0
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1
    pink = pink * 0.93 + white * 0.07
    data[i] = pink * 0.5
  }
  noiseBuffer = buf
  return buf
}

function speedToGain(speed: number): number {
  if (speed < MIN_SPEED_PX) return GAIN_MIN
  const t = Math.min(1, (speed - MIN_SPEED_PX) / (SPEED_MAX_PX - MIN_SPEED_PX))
  return GAIN_MIN + t * (GAIN_MAX - GAIN_MIN)
}

function speedToFreq(speed: number): number {
  if (speed < MIN_SPEED_PX) return FREQ_MIN
  const t = Math.min(1, (speed - MIN_SPEED_PX) / (SPEED_MAX_PX - MIN_SPEED_PX))
  return FREQ_MIN + t * (FREQ_MAX - FREQ_MIN)
}

function applyMotion(speed: number, when: number) {
  if (!nodes) return

  smoothedSpeed = smoothedSpeed * SPEED_SMOOTHING + speed * (1 - SPEED_SMOOTHING)
  const gain = speedToGain(smoothedSpeed)
  const freq = speedToFreq(smoothedSpeed)

  nodes.gain.gain.cancelScheduledValues(when)
  nodes.gain.gain.setValueAtTime(nodes.gain.gain.value, when)
  nodes.gain.gain.linearRampToValueAtTime(gain, when + RAMP_SEC)

  nodes.filter.frequency.cancelScheduledValues(when)
  nodes.filter.frequency.setValueAtTime(nodes.filter.frequency.value, when)
  nodes.filter.frequency.linearRampToValueAtTime(freq, when + RAMP_SEC)
}

export function startItemDragSound(): void {
  void startItemDragSoundAsync()
}

async function startItemDragSoundAsync(): Promise<void> {
  if (!canPlay()) return

  stopItemDragSound()

  const context = ensureAudioContext()
  const master = getSfxMasterGainNode()
  if (!context || !master) return

  await resumeAudioContext()
  setMasterOutputGain(SFX_ON_GAIN)

  const source = context.createBufferSource()
  source.buffer = getNoiseBuffer(context)
  source.loop = true

  const filter = context.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 0.55
  filter.frequency.value = FREQ_MIN

  const gain = context.createGain()
  gain.gain.value = GAIN_MIN

  source.connect(filter)
  filter.connect(gain)
  gain.connect(master)

  const when = context.currentTime
  source.start(when)
  nodes = { source, filter, gain }
  resetMotionTracking()
  armIdleFade()
}

export function updateItemDragSound(clientX: number, clientY: number): void {
  if (!nodes) return

  const context = ensureAudioContext()
  if (!context) return

  const now = performance.now()
  if (lastSpeedSampleAt === 0) {
    lastClientX = clientX
    lastClientY = clientY
    lastSpeedSampleAt = now
    return
  }

  const dt = (now - lastSpeedSampleAt) / 1000
  if (dt < 0.012) return

  const dist = Math.hypot(clientX - lastClientX, clientY - lastClientY)

  lastClientX = clientX
  lastClientY = clientY
  lastSpeedSampleAt = now

  if (dist < 1.5) return

  armIdleFade()
  applyMotion(dist / dt, context.currentTime)
}

export function stopItemDragSound(): void {
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
    active.source.stop(when + FADE_OUT_SEC + 0.15)
  } catch {
    // already stopped
  }
}

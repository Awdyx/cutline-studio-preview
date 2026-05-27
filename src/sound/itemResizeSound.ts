import {
  ensureAudioContext,
  getSfxMasterGainNode,
  resumeAudioContext,
  setMasterOutputGain,
} from './soundEngine'
import { SFX_ON_GAIN } from './soundLevels'
import { RESIZE_SFX_LEVEL } from './soundGains'
import { useSoundStore } from './soundStore'

const SPEED_MAX_PX = 1200
const MIN_SPEED_PX = 8
/** Audible idle floor while the handle is held — distinct from drag's near-silent idle. */
const GAIN_IDLE = 0.008 * RESIZE_SFX_LEVEL
const GAIN_MAX = 0.043 * RESIZE_SFX_LEVEL
const FREQ_MIN = 220
const FREQ_MAX = 580
const RAMP_SEC = 0.055
const SPEED_SMOOTHING = 0.76

type ResizeNodes = {
  source: AudioBufferSourceNode
  filter: BiquadFilterNode
  gain: GainNode
}

let nodes: ResizeNodes | null = null
let noiseBuffer: AudioBuffer | null = null
let lastClientX = 0
let lastClientY = 0
let lastSpeedSampleAt = 0
let smoothedSpeed = 0

function canPlay(): boolean {
  const { muted, hydrated } = useSoundStore.getState()
  return hydrated && !muted
}

function resetMotionTracking(clientX?: number, clientY?: number) {
  lastClientX = clientX ?? 0
  lastClientY = clientY ?? 0
  lastSpeedSampleAt = clientX != null ? performance.now() : 0
  smoothedSpeed = 0
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
    data[i] = pink * 0.48
  }
  noiseBuffer = buf
  return buf
}

function speedToGain(speed: number): number {
  if (speed < MIN_SPEED_PX) return GAIN_IDLE
  const t = Math.min(1, (speed - MIN_SPEED_PX) / (SPEED_MAX_PX - MIN_SPEED_PX))
  return GAIN_IDLE + t * (GAIN_MAX - GAIN_IDLE)
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

export function startItemResizeSound(clientX?: number, clientY?: number): void {
  if (!canPlay()) return

  stopItemResizeSound()

  const context = ensureAudioContext()
  const master = getSfxMasterGainNode()
  if (!context || !master) return

  void resumeAudioContext()
  setMasterOutputGain(SFX_ON_GAIN)

  const source = context.createBufferSource()
  source.buffer = getNoiseBuffer(context)
  source.loop = true

  const filter = context.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 0.72
  filter.frequency.value = FREQ_MIN

  const gain = context.createGain()
  gain.gain.value = GAIN_IDLE

  source.connect(filter)
  filter.connect(gain)
  gain.connect(master)

  const when = context.currentTime
  source.start(when)
  nodes = { source, filter, gain }
  resetMotionTracking(clientX, clientY)
}

export function updateItemResizeSound(clientX: number, clientY: number): void {
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
  if (dt < 0.01) return

  const dist = Math.hypot(clientX - lastClientX, clientY - lastClientY)
  const speed = dist < 1 ? 0 : dist / dt

  lastClientX = clientX
  lastClientY = clientY
  lastSpeedSampleAt = now

  applyMotion(speed, context.currentTime)
}

export function stopItemResizeSound(): void {
  const context = ensureAudioContext()
  const active = nodes
  nodes = null
  resetMotionTracking()

  if (!active || !context) return

  const when = context.currentTime
  active.gain.gain.cancelScheduledValues(when)
  active.gain.gain.setValueAtTime(active.gain.gain.value, when)
  active.gain.gain.linearRampToValueAtTime(0.0001, when + 0.08)

  try {
    active.source.stop(when + 0.09)
  } catch {
    // already stopped
  }
}

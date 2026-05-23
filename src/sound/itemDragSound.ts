import {
  ensureAudioContext,
  getSfxMasterGainNode,
  resumeAudioContext,
  setMasterOutputGain,
} from './soundEngine'
import { SFX_ON_GAIN } from './soundLevels'
import { CONTINUOUS_SFX_LEVEL } from './soundGains'
import { useSoundStore } from './soundStore'

const SPEED_MAX_PX = 1400
const MIN_SPEED_PX = 20
const GAIN_MIN = 0.001872 * CONTINUOUS_SFX_LEVEL
const GAIN_MAX = 0.03744 * CONTINUOUS_SFX_LEVEL
const FREQ_MIN = 300
const FREQ_MAX = 720
const RAMP_SEC = 0.05
const SPEED_SMOOTHING = 0.75

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

function canPlay(): boolean {
  const { muted, hydrated } = useSoundStore.getState()
  return hydrated && !muted
}

function resetMotionTracking() {
  lastClientX = 0
  lastClientY = 0
  lastSpeedSampleAt = 0
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
  if (!canPlay()) return

  stopItemDragSound()

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
  const speed = dist < 1.5 ? 0 : dist / dt

  lastClientX = clientX
  lastClientY = clientY
  lastSpeedSampleAt = now

  applyMotion(speed, context.currentTime)
}

export function stopItemDragSound(): void {
  const context = ensureAudioContext()
  const active = nodes
  nodes = null
  resetMotionTracking()

  if (!active || !context) return

  const when = context.currentTime
  active.gain.gain.cancelScheduledValues(when)
  active.gain.gain.setValueAtTime(active.gain.gain.value, when)
  active.gain.gain.linearRampToValueAtTime(0.0001, when + 0.07)

  try {
    active.source.stop(when + 0.08)
  } catch {
    // already stopped
  }
}

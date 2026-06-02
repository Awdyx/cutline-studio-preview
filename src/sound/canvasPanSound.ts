import {
  ensureAudioContext,
  getSfxMasterGainNode,
  resumeAudioContext,
  setMasterOutputGain,
} from './soundEngine'
import { SFX_ON_GAIN } from './soundLevels'
import { PAN_SFX_LEVEL } from './soundGains'
import { useSoundStore } from './soundStore'

/**
 * Canvas pan whoosh — a speed-reactive looping bed (same shape as the drag /
 * resize beds) but a distinct, airier timbre: high-passed pink noise through a
 * resonant low-pass that opens as you fling, reading as rushing air rather than
 * the low-mid "scrape" of dragging an item.
 */
const GAIN_IDLE = 0.013 * PAN_SFX_LEVEL
const GAIN_MAX = 0.04 * PAN_SFX_LEVEL
const LP_MIN = 110
const LP_MAX = 520
const HP_HZ = 45
const RAMP_SEC = 0.06
const SMOOTHING = 0.8
/** Long, gentle tail so releasing the canvas glides to silence. */
const RELEASE_SEC = 2
/** Per-frame pan velocity (px) that reaches peak loudness. */
const SPEED_MAX = 48
/** Mild curve: gradual faster=louder / slower=softer, without crushing slow pans to silence. */
const SPEED_CURVE = 1.1

type PanNodes = {
  source: AudioBufferSourceNode
  highpass: BiquadFilterNode
  lowpass: BiquadFilterNode
  gain: GainNode
}

let nodes: PanNodes | null = null
let noiseBuffer: AudioBuffer | null = null
let smoothed = 0

function canPlay(): boolean {
  const { muted, hydrated } = useSoundStore.getState()
  return hydrated && !muted
}

function getNoiseBuffer(context: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === context.sampleRate) return noiseBuffer

  const duration = 0.5
  const len = Math.floor(context.sampleRate * duration)
  const buf = context.createBuffer(1, len, context.sampleRate)
  const data = buf.getChannelData(0)
  let pink = 0
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1
    pink = pink * 0.9 + white * 0.1
    data[i] = pink * 0.5
  }
  noiseBuffer = buf
  return buf
}

function applyMotion(speed: number, when: number) {
  if (!nodes) return

  const norm = Math.max(0, Math.min(1, speed / SPEED_MAX))
  const t = norm ** SPEED_CURVE
  smoothed = smoothed * SMOOTHING + t * (1 - SMOOTHING)
  const gain = GAIN_IDLE + smoothed * (GAIN_MAX - GAIN_IDLE)
  const cutoff = LP_MIN + smoothed * (LP_MAX - LP_MIN)

  nodes.gain.gain.cancelScheduledValues(when)
  nodes.gain.gain.setValueAtTime(nodes.gain.gain.value, when)
  nodes.gain.gain.linearRampToValueAtTime(gain, when + RAMP_SEC)

  nodes.lowpass.frequency.cancelScheduledValues(when)
  nodes.lowpass.frequency.setValueAtTime(nodes.lowpass.frequency.value, when)
  nodes.lowpass.frequency.linearRampToValueAtTime(cutoff, when + RAMP_SEC)
}

export function startCanvasPanSound(): void {
  void startCanvasPanSoundAsync()
}

async function startCanvasPanSoundAsync(): Promise<void> {
  if (!canPlay()) return

  stopCanvasPanSound()

  const context = ensureAudioContext()
  const master = getSfxMasterGainNode()
  if (!context || !master) return

  await resumeAudioContext()
  setMasterOutputGain(SFX_ON_GAIN)

  const source = context.createBufferSource()
  source.buffer = getNoiseBuffer(context)
  source.loop = true

  const highpass = context.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = HP_HZ
  highpass.Q.value = 0.5

  const lowpass = context.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = LP_MIN
  lowpass.Q.value = 1.05

  const gain = context.createGain()
  gain.gain.value = GAIN_IDLE

  source.connect(highpass)
  highpass.connect(lowpass)
  lowpass.connect(gain)
  gain.connect(master)

  source.start(context.currentTime)
  nodes = { source, highpass, lowpass, gain }
  smoothed = 0
}

export function updateCanvasPanSound(speed: number): void {
  if (!nodes) return
  const context = ensureAudioContext()
  if (!context) return
  applyMotion(speed, context.currentTime)
}

export function stopCanvasPanSound(): void {
  const context = ensureAudioContext()
  const active = nodes
  nodes = null
  smoothed = 0

  if (!active || !context) return

  const when = context.currentTime
  active.gain.gain.cancelScheduledValues(when)
  active.gain.gain.setValueAtTime(Math.max(active.gain.gain.value, 0.0001), when)
  // Exponential tail reads as a soft, natural glide to silence.
  active.gain.gain.exponentialRampToValueAtTime(0.0001, when + RELEASE_SEC)
  active.gain.gain.linearRampToValueAtTime(0, when + RELEASE_SEC + 0.05)

  // Let the cutoff close as it fades, darkening the tail.
  active.lowpass.frequency.cancelScheduledValues(when)
  active.lowpass.frequency.setValueAtTime(active.lowpass.frequency.value, when)
  active.lowpass.frequency.linearRampToValueAtTime(LP_MIN, when + RELEASE_SEC)

  try {
    active.source.stop(when + RELEASE_SEC + 0.1)
  } catch {
    // already stopped
  }
}

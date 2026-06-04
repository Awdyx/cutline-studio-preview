import {
  ensureAudioContext,
  getSfxMasterGainNode,
  resumeAudioContext,
  setMasterOutputGain,
} from './soundEngine'
import { SFX_ON_GAIN } from './soundLevels'
import { ZOOM_SFX_LEVEL } from './soundGains'
import { useSoundStore } from './soundStore'

/**
 * Canvas zoom — filtered air bed (no pitched tones). Zoom in opens a light,
 * forward rush; zoom out darkens into a soft recede. Complementary filter
 * pairs, not musical intervals.
 */
const GAIN_IDLE = 0.0026 * ZOOM_SFX_LEVEL
const GAIN_MAX = 0.017 * ZOOM_SFX_LEVEL
const SPEED_MAX = 0.045
const SPEED_CURVE = 1.12
const RAMP_SEC = 0.06
const SPEED_SMOOTHING = 0.8
const DIR_SMOOTHING = 0.74
const RELEASE_SEC = 1.6

/** Zoom in — airy, slightly bright friction. */
const HP_IN = 62
const LP_IN_MIN = 260
const LP_IN_MAX = 740

/** Zoom out — muted, low-mid body. */
const HP_OUT = 38
const LP_OUT_MIN = 68
const LP_OUT_MAX = 320

type ZoomNodes = {
  source: AudioBufferSourceNode
  highpass: BiquadFilterNode
  lowpass: BiquadFilterNode
  gain: GainNode
}

let nodes: ZoomNodes | null = null
let noiseBuffer: AudioBuffer | null = null
let smoothedSpeed = 0
let smoothedDir = 0
let zoomSoundGeneration = 0

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
    pink = pink * 0.92 + white * 0.08
    data[i] = pink * 0.42
  }
  noiseBuffer = buf
  return buf
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function applyMotion(speed: number, direction: number, when: number) {
  if (!nodes) return

  const norm = Math.max(0, Math.min(1, speed / SPEED_MAX))
  const t = norm ** SPEED_CURVE
  smoothedSpeed = smoothedSpeed * SPEED_SMOOTHING + t * (1 - SPEED_SMOOTHING)

  const dirTarget = direction > 0.000002 ? 1 : direction < -0.000002 ? -1 : 0
  smoothedDir = smoothedDir * DIR_SMOOTHING + dirTarget * (1 - DIR_SMOOTHING)
  const dirMix = (smoothedDir + 1) * 0.5

  const hp = lerp(HP_OUT, HP_IN, dirMix)
  const lpMin = lerp(LP_OUT_MIN, LP_IN_MIN, dirMix)
  const lpMax = lerp(LP_OUT_MAX, LP_IN_MAX, dirMix)
  const gain = GAIN_IDLE + smoothedSpeed * (GAIN_MAX - GAIN_IDLE)
  const cutoff = lpMin + smoothedSpeed * (lpMax - lpMin)

  nodes.gain.gain.cancelScheduledValues(when)
  nodes.gain.gain.setValueAtTime(nodes.gain.gain.value, when)
  nodes.gain.gain.linearRampToValueAtTime(gain, when + RAMP_SEC)

  nodes.highpass.frequency.cancelScheduledValues(when)
  nodes.highpass.frequency.setValueAtTime(nodes.highpass.frequency.value, when)
  nodes.highpass.frequency.linearRampToValueAtTime(hp, when + RAMP_SEC)

  nodes.lowpass.frequency.cancelScheduledValues(when)
  nodes.lowpass.frequency.setValueAtTime(nodes.lowpass.frequency.value, when)
  nodes.lowpass.frequency.linearRampToValueAtTime(cutoff, when + RAMP_SEC)
}

export function startCanvasZoomSound(): void {
  const gen = ++zoomSoundGeneration
  void startCanvasZoomSoundAsync(gen)
}

async function startCanvasZoomSoundAsync(expectedGen: number): Promise<void> {
  if (!canPlay() || expectedGen !== zoomSoundGeneration) return

  releaseZoomNodes()

  const context = ensureAudioContext()
  const master = getSfxMasterGainNode()
  if (!context || !master) return

  await resumeAudioContext()
  if (expectedGen !== zoomSoundGeneration) return
  setMasterOutputGain(SFX_ON_GAIN)

  const source = context.createBufferSource()
  source.buffer = getNoiseBuffer(context)
  source.loop = true

  const highpass = context.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = HP_OUT
  highpass.Q.value = 0.45

  const lowpass = context.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = LP_OUT_MIN
  lowpass.Q.value = 0.62

  const gain = context.createGain()
  gain.gain.value = GAIN_IDLE

  source.connect(highpass)
  highpass.connect(lowpass)
  lowpass.connect(gain)
  gain.connect(master)

  source.start(context.currentTime)
  nodes = { source, highpass, lowpass, gain }
  smoothedSpeed = 0
  smoothedDir = 0
}

export function updateCanvasZoomSound(speed: number, direction: number): void {
  if (!nodes) return
  const context = ensureAudioContext()
  if (!context) return
  applyMotion(speed, direction, context.currentTime)
}

export function stopCanvasZoomSound(): void {
  zoomSoundGeneration++
  releaseZoomNodes()
}

function releaseZoomNodes(): void {
  const context = ensureAudioContext()
  const active = nodes
  nodes = null
  smoothedSpeed = 0
  smoothedDir = 0

  if (!active || !context) return

  const when = context.currentTime
  active.gain.gain.cancelScheduledValues(when)
  active.gain.gain.setValueAtTime(Math.max(active.gain.gain.value, 0.0001), when)
  active.gain.gain.exponentialRampToValueAtTime(0.0001, when + RELEASE_SEC)
  active.gain.gain.linearRampToValueAtTime(0, when + RELEASE_SEC + 0.05)

  active.lowpass.frequency.cancelScheduledValues(when)
  active.lowpass.frequency.setValueAtTime(active.lowpass.frequency.value, when)
  active.lowpass.frequency.linearRampToValueAtTime(LP_OUT_MIN, when + RELEASE_SEC)

  active.highpass.frequency.cancelScheduledValues(when)
  active.highpass.frequency.setValueAtTime(active.highpass.frequency.value, when)
  active.highpass.frequency.linearRampToValueAtTime(HP_OUT, when + RELEASE_SEC)

  try {
    active.source.stop(when + RELEASE_SEC + 0.1)
  } catch {
    // already stopped
  }
}

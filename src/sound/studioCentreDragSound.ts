import {
  ensureAudioContext,
  getSfxMasterGainNode,
  resumeAudioContext,
  setMasterOutputGain,
} from './soundEngine'
import { SFX_ON_GAIN } from './soundLevels'
import { STUDIO_CENTRE_DRAG_SFX_LEVEL } from './soundGains'
import { useSoundStore } from './soundStore'

/**
 * Studio centre drag — a dark, tonal mass bed (sub + detuned saw + brown
 * rumble), not the bandpass noise "scrape" used for canvas items. Speed opens
 * the low-pass and lifts the hum slightly, like shifting a heavy slab.
 */
const SPEED_MAX_PX = 4200
const MIN_SPEED_PX = 18
const GAIN_IDLE = 0.0048 * STUDIO_CENTRE_DRAG_SFX_LEVEL
const GAIN_MAX = 0.072 * STUDIO_CENTRE_DRAG_SFX_LEVEL

const SUB_BASE = 44
const BODY_BASE = 56
const BODY_DETUNE_RATIO = 1.011
const SUB_MAX = 62
const BODY_MAX = 82

const MASS_LP_IDLE = 88
const MASS_LP_MAX = 210
const RUMBLE_LP_IDLE = 52
const RUMBLE_LP_MAX = 128
const RUMBLE_GAIN_IDLE = 0.14
const RUMBLE_GAIN_MAX = 0.38

const RAMP_SEC = 0.08
const SPEED_SMOOTHING = 0.7
const IDLE_GRACE_MS = 100
/** Pointer-up — long exponential glide so the mass bed doesn't chop off. */
const RELEASE_SEC = 2.35
/** Hold-still mid-drag — shorter but still soft. */
const IDLE_RELEASE_SEC = 1.05

type MassDragNodes = {
  sub: OscillatorNode
  body: OscillatorNode
  bodyDetune: OscillatorNode
  rumble: AudioBufferSourceNode
  rumbleHp: BiquadFilterNode
  rumbleLp: BiquadFilterNode
  rumbleGain: GainNode
  massLowpass: BiquadFilterNode
  gain: GainNode
}

let nodes: MassDragNodes | null = null
let brownBuffer: AudioBuffer | null = null
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

function applySmoothRelease(active: MassDragNodes, when: number, durationSec: number): void {
  const currentGain = Math.max(active.gain.gain.value, 0.0001)
  active.gain.gain.cancelScheduledValues(when)
  active.gain.gain.setValueAtTime(currentGain, when)
  active.gain.gain.exponentialRampToValueAtTime(0.0001, when + durationSec)

  active.massLowpass.frequency.cancelScheduledValues(when)
  active.massLowpass.frequency.setValueAtTime(active.massLowpass.frequency.value, when)
  active.massLowpass.frequency.linearRampToValueAtTime(
    MASS_LP_IDLE * 0.6,
    when + durationSec,
  )

  active.rumbleGain.gain.cancelScheduledValues(when)
  active.rumbleGain.gain.setValueAtTime(
    Math.max(active.rumbleGain.gain.value, 0.0001),
    when,
  )
  active.rumbleGain.gain.exponentialRampToValueAtTime(0.0001, when + durationSec * 0.9)

  const subNow = active.sub.frequency.value
  const bodyNow = active.body.frequency.value
  active.sub.frequency.cancelScheduledValues(when)
  active.sub.frequency.setValueAtTime(subNow, when)
  active.sub.frequency.linearRampToValueAtTime(SUB_BASE * 0.86, when + durationSec)

  active.body.frequency.cancelScheduledValues(when)
  active.body.frequency.setValueAtTime(bodyNow, when)
  active.body.frequency.linearRampToValueAtTime(BODY_BASE * 0.88, when + durationSec)

  active.bodyDetune.frequency.cancelScheduledValues(when)
  active.bodyDetune.frequency.setValueAtTime(active.bodyDetune.frequency.value, when)
  active.bodyDetune.frequency.linearRampToValueAtTime(
    BODY_BASE * 0.88 * BODY_DETUNE_RATIO,
    when + durationSec,
  )
}

function armIdleFade() {
  clearIdleTimer()
  idleTimer = window.setTimeout(() => {
    idleTimer = null
    const context = ensureAudioContext()
    if (!context || !nodes) return
    applySmoothRelease(nodes, context.currentTime, IDLE_RELEASE_SEC)
  }, IDLE_GRACE_MS)
}

function getBrownBuffer(context: AudioContext): AudioBuffer {
  if (brownBuffer && brownBuffer.sampleRate === context.sampleRate) return brownBuffer

  const duration = 1.4
  const len = Math.floor(context.sampleRate * duration)
  const buf = context.createBuffer(1, len, context.sampleRate)
  const data = buf.getChannelData(0)
  let brown = 0
  for (let i = 0; i < len; i++) {
    brown = (brown + (Math.random() * 2 - 1) * 0.22) * 0.985
    data[i] = brown * 0.42
  }
  brownBuffer = buf
  return buf
}

function speedNorm(speed: number): number {
  if (speed < MIN_SPEED_PX) return 0
  return Math.min(1, (speed - MIN_SPEED_PX) / (SPEED_MAX_PX - MIN_SPEED_PX))
}

function applyMotion(speed: number, when: number) {
  if (!nodes) return

  smoothedSpeed = smoothedSpeed * SPEED_SMOOTHING + speed * (1 - SPEED_SMOOTHING)
  const t = speedNorm(smoothedSpeed)

  const gain = GAIN_IDLE + t * (GAIN_MAX - GAIN_IDLE)
  const subHz = SUB_BASE + t * (SUB_MAX - SUB_BASE)
  const bodyHz = BODY_BASE + t * (BODY_MAX - BODY_BASE)
  const massLp = MASS_LP_IDLE + t * (MASS_LP_MAX - MASS_LP_IDLE)
  const rumbleLp = RUMBLE_LP_IDLE + t * (RUMBLE_LP_MAX - RUMBLE_LP_IDLE)
  const rumbleGain = RUMBLE_GAIN_IDLE + t * (RUMBLE_GAIN_MAX - RUMBLE_GAIN_IDLE)

  nodes.gain.gain.cancelScheduledValues(when)
  nodes.gain.gain.setValueAtTime(nodes.gain.gain.value, when)
  nodes.gain.gain.linearRampToValueAtTime(gain, when + RAMP_SEC)

  nodes.sub.frequency.cancelScheduledValues(when)
  nodes.sub.frequency.setValueAtTime(nodes.sub.frequency.value, when)
  nodes.sub.frequency.linearRampToValueAtTime(subHz, when + RAMP_SEC)

  nodes.body.frequency.cancelScheduledValues(when)
  nodes.body.frequency.setValueAtTime(nodes.body.frequency.value, when)
  nodes.body.frequency.linearRampToValueAtTime(bodyHz, when + RAMP_SEC)

  nodes.bodyDetune.frequency.cancelScheduledValues(when)
  nodes.bodyDetune.frequency.setValueAtTime(nodes.bodyDetune.frequency.value, when)
  nodes.bodyDetune.frequency.linearRampToValueAtTime(
    bodyHz * BODY_DETUNE_RATIO,
    when + RAMP_SEC,
  )

  nodes.massLowpass.frequency.cancelScheduledValues(when)
  nodes.massLowpass.frequency.setValueAtTime(nodes.massLowpass.frequency.value, when)
  nodes.massLowpass.frequency.linearRampToValueAtTime(massLp, when + RAMP_SEC)

  nodes.rumbleLp.frequency.cancelScheduledValues(when)
  nodes.rumbleLp.frequency.setValueAtTime(nodes.rumbleLp.frequency.value, when)
  nodes.rumbleLp.frequency.linearRampToValueAtTime(rumbleLp, when + RAMP_SEC)

  nodes.rumbleGain.gain.cancelScheduledValues(when)
  nodes.rumbleGain.gain.setValueAtTime(nodes.rumbleGain.gain.value, when)
  nodes.rumbleGain.gain.linearRampToValueAtTime(rumbleGain, when + RAMP_SEC)
}

export function startStudioCentreDragSound(): void {
  void startStudioCentreDragSoundAsync()
}

async function startStudioCentreDragSoundAsync(): Promise<void> {
  if (!canPlay()) return

  stopStudioCentreDragSound()

  const context = ensureAudioContext()
  const master = getSfxMasterGainNode()
  if (!context || !master) return

  await resumeAudioContext()
  setMasterOutputGain(SFX_ON_GAIN)

  const sub = context.createOscillator()
  sub.type = 'sine'
  sub.frequency.value = SUB_BASE

  const body = context.createOscillator()
  body.type = 'sawtooth'
  body.frequency.value = BODY_BASE

  const bodyDetune = context.createOscillator()
  bodyDetune.type = 'triangle'
  bodyDetune.frequency.value = BODY_BASE * BODY_DETUNE_RATIO

  const bodyMix = context.createGain()
  bodyMix.gain.value = 0.22

  const rumble = context.createBufferSource()
  rumble.buffer = getBrownBuffer(context)
  rumble.loop = true

  const rumbleHp = context.createBiquadFilter()
  rumbleHp.type = 'highpass'
  rumbleHp.frequency.value = 28
  rumbleHp.Q.value = 0.55

  const rumbleLp = context.createBiquadFilter()
  rumbleLp.type = 'lowpass'
  rumbleLp.frequency.value = RUMBLE_LP_IDLE
  rumbleLp.Q.value = 0.45

  const rumbleGain = context.createGain()
  rumbleGain.gain.value = RUMBLE_GAIN_IDLE

  const massLowpass = context.createBiquadFilter()
  massLowpass.type = 'lowpass'
  massLowpass.frequency.value = MASS_LP_IDLE
  massLowpass.Q.value = 0.5

  const gain = context.createGain()
  gain.gain.value = GAIN_IDLE

  sub.connect(massLowpass)
  body.connect(bodyMix)
  bodyDetune.connect(bodyMix)
  bodyMix.connect(massLowpass)
  rumble.connect(rumbleHp)
  rumbleHp.connect(rumbleLp)
  rumbleLp.connect(rumbleGain)
  rumbleGain.connect(massLowpass)
  massLowpass.connect(gain)
  gain.connect(master)

  const when = context.currentTime
  sub.start(when)
  body.start(when)
  bodyDetune.start(when)
  rumble.start(when)

  nodes = {
    sub,
    body,
    bodyDetune,
    rumble,
    rumbleHp,
    rumbleLp,
    rumbleGain,
    massLowpass,
    gain,
  }
  resetMotionTracking()
  armIdleFade()
}

export function updateStudioCentreDragSound(clientX: number, clientY: number): void {
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

export function stopStudioCentreDragSound(): void {
  const context = ensureAudioContext()
  const active = nodes
  nodes = null
  clearIdleTimer()
  resetMotionTracking()

  if (!active || !context) return

  const when = context.currentTime
  applySmoothRelease(active, when, RELEASE_SEC)

  const stopAt = when + RELEASE_SEC + 0.25
  for (const osc of [active.sub, active.body, active.bodyDetune]) {
    try {
      osc.stop(stopAt)
    } catch {
      // already stopped
    }
  }
  try {
    active.rumble.stop(stopAt)
  } catch {
    // already stopped
  }
}

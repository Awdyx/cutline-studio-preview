import { isTrackPreviewSessionActive } from '../music/trackPreviewSession'
import { isTouchFirstDevice } from '../platform/compositor'
import { ensureAudioContext } from './soundEngine'
import { MUSIC_ON_GAIN } from './soundLevels'

const MUSIC_SRC = `${import.meta.env.BASE_URL}audio/account-selection.mp3`
const INTRO_FADE_SEC = 8

/** Match study-hub menu-focus camera motion (~460–720ms) with a little overlap. */
const STUDY_SPACE_ENTER_SEC = 1.05
const STUDY_SPACE_EXIT_SEC = 0.88
/** Main-canvas void — softer than pocket entry, still noticeable. */
const STUDIO_ZONE_DISTANT_ENTER_SEC = 1.5
const STUDIO_ZONE_DISTANT_EXIT_SEC = 1.5
/** Canvas overview — slow crossfade in/out of the muffled wash. */
const OVERVIEW_ACOUSTICS_ENTER_SEC = 2
const OVERVIEW_ACOUSTICS_EXIT_SEC = 2

/** Fade ambient music out/in around profile / picker song previews. */
const TRACK_PREVIEW_TRANSITION_SEC = 2

export type BackgroundMusicAcousticsMode =
  | 'open'
  | 'distant'
  | 'overview'
  | 'enclosed'

const ACOUSTICS = {
  outside: {
    lowpassHz: 16_000,
    lowpassQ: 0.6,
    bassDb: 0,
    highShelfDb: 0,
    reverbWet: 0,
    reverbDry: 1,
    presence: 1,
    outputGain: 1,
  },
  distant: {
    /** Softer pocket-like muffling while panning in the outer canvas void. */
    lowpassHz: 6_800,
    lowpassQ: 1.6,
    bassDb: 9.5,
    highShelfDb: -16,
    reverbWet: 0.36,
    reverbDry: 0.72,
    presence: 1.12,
    outputGain: 2.25,
  },
  overview: {
    /** Zoomed-out canvas map — obvious muffled hall (stronger than void/distant). */
    lowpassHz: 1_650,
    lowpassQ: 2.6,
    bassDb: 16,
    highShelfDb: -26,
    reverbWet: 0.72,
    reverbDry: 0.28,
    presence: 1.35,
    outputGain: 3.85,
  },
  inside: {
    /** Exaggerated preset — obvious A/B when entering a space canvas. */
    lowpassHz: 120,
    lowpassQ: 3.2,
    bassDb: 24,
    highShelfDb: -32,
    reverbWet: 0.88,
    reverbDry: 0.22,
    presence: 1.55,
    /** Compensate for filter/reverb loss so the muffled mix stays audible. */
    outputGain: 5,
  },
} as const

type AcousticsPreset = (typeof ACOUSTICS)[keyof typeof ACOUSTICS]

/** Soft muffled wash while ambient music ducks under a profile preview. */
const PREVIEW_DUCK_ACOUSTICS: AcousticsPreset = {
  lowpassHz: 5_200,
  lowpassQ: 1.4,
  bassDb: 8,
  highShelfDb: -14,
  reverbWet: 0.48,
  reverbDry: 0.58,
  presence: 1.08,
  outputGain: 1,
}

function acousticsPresetForMode(mode: BackgroundMusicAcousticsMode): AcousticsPreset {
  switch (mode) {
    case 'enclosed':
      return ACOUSTICS.inside
    case 'distant':
      return ACOUSTICS.distant
    case 'overview':
      return ACOUSTICS.overview
    default:
      return ACOUSTICS.outside
  }
}

function acousticsTransitionDuration(
  from: BackgroundMusicAcousticsMode,
  to: BackgroundMusicAcousticsMode,
): number {
  if (to === 'enclosed') return STUDY_SPACE_ENTER_SEC
  if (from === 'enclosed') return STUDY_SPACE_EXIT_SEC
  if (to === 'overview') return OVERVIEW_ACOUSTICS_ENTER_SEC
  if (from === 'overview') return OVERVIEW_ACOUSTICS_EXIT_SEC
  if (to === 'distant') return STUDIO_ZONE_DISTANT_ENTER_SEC
  if (from === 'distant') return STUDIO_ZONE_DISTANT_EXIT_SEC
  return STUDIO_ZONE_DISTANT_ENTER_SEC
}

function deferHeavyWork(fn: () => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(fn, { timeout: 400 })
  } else {
    setTimeout(fn, 0)
  }
}

function createReverbImpulse(
  context: AudioContext,
  durationSec: number,
  decay: number,
): AudioBuffer {
  const sampleRate = context.sampleRate
  const length = Math.max(1, Math.floor(sampleRate * durationSec))
  const impulse = context.createBuffer(2, length, sampleRate)
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay
    }
  }
  return impulse
}

let musicCtx: AudioContext | null = null
let musicGain: GainNode | null = null
let musicLowpass: BiquadFilterNode | null = null
let musicBassShelf: BiquadFilterNode | null = null
let musicHighShelf: BiquadFilterNode | null = null
let musicConvolver: ConvolverNode | null = null
let musicDryGain: GainNode | null = null
let musicWetGain: GainNode | null = null
let musicPresenceGain: GainNode | null = null
let musicReverbEnabled = false

function ensureMusicContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!musicCtx) {
      const sharedCtx = isTouchFirstDevice() ? ensureAudioContext() : null
      if (sharedCtx) {
        musicCtx = sharedCtx
      } else {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
        if (!Ctx) return null
        musicCtx = new Ctx()
      }
      musicGain = musicCtx.createGain()
      musicGain.gain.value = 0
      musicGain.connect(musicCtx.destination)
    }
    return musicCtx
  } catch {
    return null
  }
}

let musicEffectsReady = false

function ensureMusicEffectChain(): boolean {
  const ctx = ensureMusicContext()
  if (!ctx || !musicGain) return false
  if (musicEffectsReady) return musicLowpass != null

  try {
    musicLowpass = ctx.createBiquadFilter()
    musicLowpass.type = 'lowpass'
    musicLowpass.frequency.value = ACOUSTICS.outside.lowpassHz
    musicLowpass.Q.value = ACOUSTICS.outside.lowpassQ

    musicBassShelf = ctx.createBiquadFilter()
    musicBassShelf.type = 'lowshelf'
    musicBassShelf.frequency.value = 120
    musicBassShelf.gain.value = ACOUSTICS.outside.bassDb

    musicHighShelf = ctx.createBiquadFilter()
    musicHighShelf.type = 'highshelf'
    musicHighShelf.frequency.value = 3_200
    musicHighShelf.gain.value = ACOUSTICS.outside.highShelfDb

    musicLowpass.connect(musicBassShelf)
    musicBassShelf.connect(musicHighShelf)

    const touchFirst = isTouchFirstDevice()
    if (!touchFirst) {
      try {
        musicConvolver = ctx.createConvolver()
        musicConvolver.buffer = createReverbImpulse(ctx, 2.8, 1.65)
        musicConvolver.normalize = true

        musicDryGain = ctx.createGain()
        musicDryGain.gain.value = ACOUSTICS.outside.reverbDry

        musicWetGain = ctx.createGain()
        musicWetGain.gain.value = ACOUSTICS.outside.reverbWet

        musicPresenceGain = ctx.createGain()
        musicPresenceGain.gain.value = ACOUSTICS.outside.presence

        musicHighShelf.connect(musicDryGain)
        musicHighShelf.connect(musicConvolver)
        musicConvolver.connect(musicWetGain)
        musicDryGain.connect(musicPresenceGain)
        musicWetGain.connect(musicPresenceGain)
        musicPresenceGain.connect(musicGain)
        musicReverbEnabled = true
      } catch (reverbErr) {
        console.warn('[music] reverb unavailable, using filter-only path', reverbErr)
        musicHighShelf.connect(musicGain)
        musicConvolver = null
        musicDryGain = null
        musicWetGain = null
        musicPresenceGain = null
        musicReverbEnabled = false
      }
    } else {
      musicHighShelf.connect(musicGain)
      musicReverbEnabled = false
    }

    musicEffectsReady = true
    return true
  } catch (err) {
    console.warn('[music] effect chain unavailable', err)
    musicLowpass = null
    musicBassShelf = null
    musicHighShelf = null
    musicConvolver = null
    musicDryGain = null
    musicWetGain = null
    musicPresenceGain = null
    musicReverbEnabled = false
    musicEffectsReady = true
    return false
  }
}

function musicInputNode(): AudioNode | null {
  if (!ensureMusicContext() || !musicGain) return null
  ensureMusicEffectChain()
  return musicLowpass ?? musicGain
}

function rampParam(
  param: AudioParam,
  from: number,
  to: number,
  start: number,
  durationSec: number,
  exponential = false,
): void {
  param.cancelScheduledValues(start)
  if (durationSec <= 0) {
    param.setValueAtTime(to, start)
    return
  }
  const safeFrom = exponential ? Math.max(from, 0.0001) : from
  const safeTo = exponential ? Math.max(to, 0.0001) : to
  param.setValueAtTime(safeFrom, start)
  if (exponential) {
    param.exponentialRampToValueAtTime(safeTo, start + durationSec)
  } else {
    param.linearRampToValueAtTime(safeTo, start + durationSec)
  }
}

function applyAcousticsTarget(target: AcousticsPreset, durationSec: number): void {
  if (!ensureMusicEffectChain()) return
  const ctx = musicCtx
  if (!ctx || !musicLowpass || !musicBassShelf || !musicHighShelf) return

  const now = ctx.currentTime

  rampParam(
    musicLowpass.frequency,
    musicLowpass.frequency.value,
    target.lowpassHz,
    now,
    durationSec,
    true,
  )
  rampParam(
    musicLowpass.Q,
    musicLowpass.Q.value,
    target.lowpassQ,
    now,
    durationSec,
  )
  rampParam(
    musicBassShelf.gain,
    musicBassShelf.gain.value,
    target.bassDb,
    now,
    durationSec,
  )
  rampParam(
    musicHighShelf.gain,
    musicHighShelf.gain.value,
    target.highShelfDb,
    now,
    durationSec,
  )

  if (!musicReverbEnabled || !musicDryGain || !musicWetGain || !musicPresenceGain) {
    return
  }

  rampParam(
    musicDryGain.gain,
    musicDryGain.gain.value,
    target.reverbDry,
    now,
    durationSec,
  )
  rampParam(
    musicWetGain.gain,
    musicWetGain.gain.value,
    target.reverbWet,
    now,
    durationSec,
  )
  rampParam(
    musicPresenceGain.gain,
    musicPresenceGain.gain.value,
    target.presence,
    now,
    durationSec,
  )
}

function applyAcousticsMode(
  mode: BackgroundMusicAcousticsMode,
  durationSec: number,
): void {
  applyAcousticsTarget(acousticsPresetForMode(mode), durationSec)
}

function waitSec(sec: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, sec) * 1000)
  })
}

export async function resumeMusicContext(): Promise<void> {
  const context = ensureMusicContext()
  if (!context) return
  if (context.state === 'suspended') {
    await context.resume().catch(() => undefined)
  }
}

function rampMusicOutputGain(
  from: number,
  to: number,
  durationSec: number,
): void {
  const context = ensureMusicContext()
  if (!context || !musicGain) return
  const now = context.currentTime
  musicGain.gain.cancelScheduledValues(now)
  musicGain.gain.setValueAtTime(Math.max(0, from), now)
  musicGain.gain.linearRampToValueAtTime(Math.max(0, to), now + durationSec)
}

function setMusicOutputGainImmediate(gain: number): void {
  if (!musicGain || !musicCtx) return
  musicGain.gain.cancelScheduledValues(musicCtx.currentTime)
  musicGain.gain.setValueAtTime(Math.max(0, gain), musicCtx.currentTime)
}

class BackgroundMusicController {
  private audio: HTMLAudioElement | null = null
  private elementSource: MediaElementAudioSourceNode | null = null
  private sourceCreated = false
  private enabled = false
  private playing = false
  private startQueued = false
  private loadFailed = false
  private acousticsMode: BackgroundMusicAcousticsMode = 'open'
  private pendingAcousticsMode: BackgroundMusicAcousticsMode | null = null
  /** Whether ambient music should return after the current preview session ends. */
  private ambientShouldResumeAfterPreview = false
  private previewTransitionGeneration = 0

  private baseOutputGain(): number {
    if (!this.enabled) return 0
    const mult = acousticsPresetForMode(this.acousticsMode).outputGain
    return MUSIC_ON_GAIN * mult
  }

  private effectiveOutputGain(): number {
    if (!this.enabled || isTrackPreviewSessionActive()) return 0
    return this.baseOutputGain()
  }

  private isBlockedByTrackPreview(): boolean {
    return isTrackPreviewSessionActive()
  }

  private rampToEffectiveOutput(durationSec: number): void {
    if (!musicGain || !musicCtx) return
    rampParam(
      musicGain.gain,
      musicGain.gain.value,
      this.effectiveOutputGain(),
      musicCtx.currentTime,
      durationSec,
    )
  }

  private rampOutputGainForMode(_mode: BackgroundMusicAcousticsMode, durationSec: number): void {
    if (!this.enabled || !musicGain || !musicCtx) return
    if (this.isBlockedByTrackPreview()) {
      return
    }
    this.rampToEffectiveOutput(durationSec)
  }

  /** Capture ambient state once, then fade it out under a profile / picker preview. */
  prepareForTrackPreview(): void {
    if (!this.ambientShouldResumeAfterPreview) {
      const el = this.audio
      this.ambientShouldResumeAfterPreview = !!(el && !el.paused && this.playing)
    }
    if (!this.ambientShouldResumeAfterPreview) return

    const el = this.audio
    const generation = ++this.previewTransitionGeneration

    ensureMusicContext()
    this.wireToContext()

    void (async () => {
      await resumeMusicContext()
      if (generation !== this.previewTransitionGeneration || !musicGain) return

      applyAcousticsTarget(PREVIEW_DUCK_ACOUSTICS, TRACK_PREVIEW_TRANSITION_SEC)
      rampMusicOutputGain(musicGain.gain.value, 0, TRACK_PREVIEW_TRANSITION_SEC)

      await waitSec(TRACK_PREVIEW_TRANSITION_SEC)
      if (generation !== this.previewTransitionGeneration) return

      if (el && !el.paused) el.pause()
      this.playing = false
    })()
  }

  private ensureElement(): HTMLAudioElement | null {
    if (!this.audio) {
      this.audio = new Audio(MUSIC_SRC)
      this.audio.preload = 'auto'
      this.audio.loop = true
      this.audio.addEventListener('error', () => {
        this.loadFailed = true
        this.stop()
      })
    }
    return this.audio
  }

  private wireToContext(): boolean {
    const ctx = ensureMusicContext()
    const el = this.ensureElement()
    const input = musicInputNode()
    if (!ctx || !el || !input || this.loadFailed) return false

    if (!this.sourceCreated) {
      try {
        this.elementSource = ctx.createMediaElementSource(el)
        this.elementSource.connect(input)
        this.sourceCreated = true
      } catch (err) {
        console.warn('[music] MediaElementSource failed', err)
        return false
      }
    }

    this.applyPendingAcousticsMode()

    return true
  }

  private applyPendingAcousticsMode(): void {
    if (!this.sourceCreated || !musicLowpass) return

    if (this.pendingAcousticsMode != null) {
      const pending = this.pendingAcousticsMode
      this.pendingAcousticsMode = null
      this.acousticsMode = pending
      applyAcousticsMode(pending, 0)
      this.rampOutputGainForMode(pending, 0)
    } else if (this.acousticsMode !== 'open') {
      applyAcousticsMode(this.acousticsMode, 0)
      this.rampOutputGainForMode(this.acousticsMode, 0)
    }
  }

  private async startPlayback(): Promise<void> {
    if (!this.enabled || this.loadFailed) return

    if (this.isBlockedByTrackPreview()) return

    if (this.playing && this.audio && !this.audio.paused) return
    if (!this.wireToContext()) return

    const el = this.audio!
    if (!Number.isFinite(el.duration) && el.readyState < HTMLMediaElement.HAVE_METADATA) {
      await new Promise<void>((resolve) => {
        const done = () => {
          el.removeEventListener('loadedmetadata', done)
          el.removeEventListener('error', done)
          resolve()
        }
        el.addEventListener('loadedmetadata', done)
        el.addEventListener('error', done)
      })
      if (this.loadFailed || !Number.isFinite(el.duration)) return
    }

    await resumeMusicContext()

    if (this.isBlockedByTrackPreview()) return

    el.volume = 1
    if (!this.playing) {
      rampMusicOutputGain(0, this.effectiveOutputGain(), INTRO_FADE_SEC)
    }

    try {
      if (el.paused) {
        if (!this.playing) el.currentTime = 0
        await el.play()
      }
      this.playing = true
      void import('./backgroundMusicAcoustics').then(({ syncBackgroundMusicAcoustics }) => {
        syncBackgroundMusicAcoustics()
      })
    } catch {
      this.playing = false
    }
  }

  private queueStartPlayback(): void {
    if (!this.enabled || this.loadFailed) return
    if (this.isBlockedByTrackPreview()) return
    if (this.playing && this.audio && !this.audio.paused) return
    if (this.startQueued) return
    this.startQueued = true
    deferHeavyWork(() => {
      this.startQueued = false
      void this.startPlayback()
    })
  }

  sync(enabled: boolean): void {
    this.enabled = enabled

    if (!enabled) {
      this.stop()
      return
    }

    if (this.isBlockedByTrackPreview()) return

    this.queueStartPlayback()
  }

  /** Call on user gesture so autoplay policy allows playback (never from SFX path). */
  unlock(): void {
    void resumeMusicContext().then(() => {
      if (this.isBlockedByTrackPreview()) return
      this.queueStartPlayback()
    })
  }

  /** Resume the music AudioContext (safe to call from a user-gesture handler). */
  resumeContext(): Promise<void> {
    return resumeMusicContext()
  }

  isPlaying(): boolean {
    return this.playing && !!this.audio && !this.audio.paused
  }

  getAcousticsMode(): BackgroundMusicAcousticsMode {
    return this.acousticsMode
  }

  /** Warm the MP3 in the background without wiring Web Audio or playing. */
  preload(): void {
    const el = this.ensureElement()
    if (!el || this.loadFailed) return
    if (el.readyState < HTMLMediaElement.HAVE_METADATA) {
      el.load()
    }
  }

  /**
   * Open / distant-void / enclosed acoustics for ambient UI music.
   */
  setAcousticsMode(
    mode: BackgroundMusicAcousticsMode,
    opts?: { immediate?: boolean; durationSec?: number; force?: boolean },
  ): void {
    if (
      !opts?.force &&
      mode === this.acousticsMode &&
      opts?.immediate !== true
    ) {
      return
    }

    const prev = this.acousticsMode
    this.acousticsMode = mode

    if (!this.sourceCreated) {
      this.pendingAcousticsMode = mode
      return
    }
    if (!musicLowpass) return

    const durationSec = opts?.immediate
      ? 0
      : (opts?.durationSec ?? acousticsTransitionDuration(prev, mode))

    applyAcousticsMode(mode, durationSec)
    this.rampOutputGainForMode(mode, durationSec)
  }

  /**
   * Muffled + bass + reverb while inside a canvas space or study-hub menu focus.
   */
  setEnclosedAcoustics(
    active: boolean,
    opts?: { immediate?: boolean; durationSec?: number; force?: boolean },
  ): void {
    this.setAcousticsMode(active ? 'enclosed' : 'open', opts)
  }

  /** @deprecated Use setEnclosedAcoustics */
  setStudySpaceAcoustics(
    active: boolean,
    opts?: { immediate?: boolean; durationSec?: number },
  ): void {
    this.setEnclosedAcoustics(active, opts)
  }

  async resumeAfterTrackPreview(): Promise<void> {
    if (this.isBlockedByTrackPreview()) return
    if (!this.enabled || this.loadFailed) return

    ensureMusicContext()
    const el = this.ensureElement()
    if (!el || !musicGain || !musicCtx) return
    if (!this.wireToContext()) return

    const shouldResume = this.ambientShouldResumeAfterPreview
    this.ambientShouldResumeAfterPreview = false

    if (!shouldResume) {
      if (!this.isBlockedByTrackPreview()) {
        this.queueStartPlayback()
      }
      return
    }

    const generation = ++this.previewTransitionGeneration

    await resumeMusicContext()
    if (generation !== this.previewTransitionGeneration || this.isBlockedByTrackPreview()) {
      return
    }

    try {
      if (el.paused) await el.play()
      this.playing = true

      applyAcousticsMode(this.acousticsMode, TRACK_PREVIEW_TRANSITION_SEC)
      rampMusicOutputGain(musicGain.gain.value, this.effectiveOutputGain(), TRACK_PREVIEW_TRANSITION_SEC)
    } catch {
      this.playing = false
    }
  }

  stop(): void {
    this.previewTransitionGeneration++
    this.ambientShouldResumeAfterPreview = false
    this.playing = false
    this.startQueued = false
    if (this.audio) {
      this.audio.pause()
      this.audio.currentTime = 0
    }
    setMusicOutputGainImmediate(0)
  }
}

export const backgroundMusic = new BackgroundMusicController()

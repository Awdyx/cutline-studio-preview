import { MUSIC_ON_GAIN } from './soundLevels'

const MUSIC_SRC = `${import.meta.env.BASE_URL}audio/account-selection.mp3`
const INTRO_FADE_SEC = 8

function deferHeavyWork(fn: () => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(fn, { timeout: 400 })
  } else {
    setTimeout(fn, 0)
  }
}

let musicCtx: AudioContext | null = null
let musicGain: GainNode | null = null

function ensureMusicContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!musicCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!Ctx) return null
      musicCtx = new Ctx()
      musicGain = musicCtx.createGain()
      musicGain.gain.value = 0
      musicGain.connect(musicCtx.destination)
    }
    return musicCtx
  } catch {
    return null
  }
}

async function resumeMusicContext(): Promise<void> {
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

  private targetGain(): number {
    return this.enabled ? MUSIC_ON_GAIN : 0
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
    const bus = musicGain
    const el = this.ensureElement()
    if (!ctx || !bus || !el || this.loadFailed) return false

    if (!this.sourceCreated) {
      try {
        this.elementSource = ctx.createMediaElementSource(el)
        this.elementSource.connect(bus)
        this.sourceCreated = true
      } catch (err) {
        console.warn('[music] MediaElementSource failed', err)
        return false
      }
    }
    return true
  }

  private async startPlayback(): Promise<void> {
    if (!this.enabled || this.playing || this.loadFailed) return
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

    el.volume = 1
    await resumeMusicContext()

    rampMusicOutputGain(0, this.targetGain(), INTRO_FADE_SEC)

    try {
      el.currentTime = 0
      await el.play()
      this.playing = true
    } catch {
      this.playing = false
    }
  }

  private queueStartPlayback(): void {
    if (!this.enabled || this.playing || this.startQueued || this.loadFailed) return
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

    this.queueStartPlayback()
  }

  /** Call on user gesture so autoplay policy allows playback (never from SFX path). */
  unlock(): void {
    this.queueStartPlayback()
  }

  /** Warm the MP3 in the background without wiring Web Audio or playing. */
  preload(): void {
    const el = this.ensureElement()
    if (!el || this.loadFailed) return
    if (el.readyState < HTMLMediaElement.HAVE_METADATA) {
      el.load()
    }
  }

  stop(): void {
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

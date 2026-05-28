import { create } from 'zustand'
import { isTouchFirstDevice } from '../platform/compositor'
import { backgroundMusic } from './backgroundMusic'
import { unlockAudioFromUserGesture } from './unlockAudio'
import { ensureAudioContext, setMasterOutputGain } from './soundEngine'
import { SFX_ON_GAIN } from './soundLevels'
import {
  loadSoundSettingsFromStorage,
  saveSoundSettingsToStorage,
  type PersistedSoundSettings,
} from './soundPersistence'

type SoundState = PersistedSoundSettings & {
  hydrated: boolean
  hydrate: () => void
  setMuted: (muted: boolean) => void
  toggleMuted: () => void
  setMusicEnabled: (enabled: boolean) => void
  toggleMusicEnabled: () => void
}

let persistEnabled = false

function persist(settings: PersistedSoundSettings) {
  if (persistEnabled) saveSoundSettingsToStorage(settings)
}

function applyOutputGain(muted: boolean) {
  setMasterOutputGain(muted ? 0 : SFX_ON_GAIN)
}

function applyMusic(musicEnabled: boolean) {
  backgroundMusic.sync(musicEnabled)
}

export const useSoundStore = create<SoundState>((set, get) => ({
  muted: false,
  musicEnabled: true,
  hydrated: false,

  hydrate: () => {
    const loaded = loadSoundSettingsFromStorage()
    set({ ...loaded, hydrated: true })
    persistEnabled = true
    ensureAudioContext()
    applyOutputGain(loaded.muted)
    if (!isTouchFirstDevice()) {
      backgroundMusic.preload()
    }
    applyMusic(loaded.musicEnabled)
  },

  setMuted: (muted) => {
    set({ muted })
    persist(get())
    applyOutputGain(muted)
  },

  toggleMuted: () => {
    const muted = !get().muted
    set({ muted })
    persist(get())
    applyOutputGain(muted)
  },

  setMusicEnabled: (musicEnabled) => {
    set({ musicEnabled })
    persist(get())
    applyMusic(musicEnabled)
    if (musicEnabled) unlockAudioFromUserGesture()
  },

  toggleMusicEnabled: () => {
    const musicEnabled = !get().musicEnabled
    set({ musicEnabled })
    persist(get())
    applyMusic(musicEnabled)
    if (musicEnabled) unlockAudioFromUserGesture()
  },
}))

import { scopedStorageKey } from '../storage/storageScope'

export const SOUND_STORAGE_KEY = scopedStorageKey('cutline-sound-v1')

export type PersistedSoundSettings = {
  muted: boolean
  musicEnabled: boolean
}

const DEFAULT_SETTINGS: PersistedSoundSettings = {
  muted: false,
  musicEnabled: true,
}

export function loadSoundSettingsFromStorage(): PersistedSoundSettings {
  try {
    const raw = localStorage.getItem(SOUND_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<
      PersistedSoundSettings & { sfxVolume?: number; musicVolume?: number }
    >
    const muted =
      parsed.muted === true ||
      (typeof parsed.sfxVolume === 'number' && parsed.sfxVolume === 0)
    const musicEnabled =
      parsed.musicEnabled !== undefined
        ? parsed.musicEnabled === true
        : typeof parsed.musicVolume === 'number'
          ? parsed.musicVolume > 0
          : DEFAULT_SETTINGS.musicEnabled
    return { muted, musicEnabled }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSoundSettingsToStorage(settings: PersistedSoundSettings): void {
  try {
    localStorage.setItem(
      SOUND_STORAGE_KEY,
      JSON.stringify(settings satisfies PersistedSoundSettings),
    )
  } catch (err) {
    console.warn('[sound] failed to save settings', err)
  }
}

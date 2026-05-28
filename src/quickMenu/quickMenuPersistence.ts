import { scopedStorageKey } from '../storage/storageScope'

export const QUICK_MENU_STORAGE_KEY = scopedStorageKey('cutline-quick-menu-v1')

export type QuickMenuMode = 'shortcut' | 'study'

export type PersistedQuickMenuSettings = {
  mode: QuickMenuMode
}

function defaultQuickMenuSettings(): PersistedQuickMenuSettings {
  return { mode: 'shortcut' }
}

export function loadQuickMenuFromStorage(): PersistedQuickMenuSettings {
  try {
    const raw = localStorage.getItem(QUICK_MENU_STORAGE_KEY)
    if (!raw) return defaultQuickMenuSettings()
    const parsed = JSON.parse(raw) as Partial<PersistedQuickMenuSettings>
    return {
      mode: parsed.mode === 'study' ? 'study' : 'shortcut',
    }
  } catch {
    return defaultQuickMenuSettings()
  }
}

export function saveQuickMenuToStorage(settings: PersistedQuickMenuSettings): void {
  try {
    localStorage.setItem(
      QUICK_MENU_STORAGE_KEY,
      JSON.stringify(settings satisfies PersistedQuickMenuSettings),
    )
  } catch (err) {
    console.warn('[quick-menu] failed to save settings', err)
  }
}

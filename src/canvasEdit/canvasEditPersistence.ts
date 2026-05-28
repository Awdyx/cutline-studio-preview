import { isPhoneLayout } from '../platform/layoutProfile'

import { scopedStorageKey } from '../storage/storageScope'

export const CANVAS_EDIT_STORAGE_KEY = scopedStorageKey('cutline-canvas-edit-v1')

export type PersistedCanvasEditSettings = {
  enabled: boolean
}

function defaultCanvasEditSettings(): PersistedCanvasEditSettings {
  return {
    // Phone: editing on by default; desktop store is ignored (editing always allowed).
    enabled: isPhoneLayout(),
  }
}

export function loadCanvasEditFromStorage(): PersistedCanvasEditSettings {
  try {
    const raw = localStorage.getItem(CANVAS_EDIT_STORAGE_KEY)
    if (!raw) return defaultCanvasEditSettings()
    const parsed = JSON.parse(raw) as Partial<PersistedCanvasEditSettings>
    return {
      enabled: parsed.enabled === true,
    }
  } catch {
    return defaultCanvasEditSettings()
  }
}

export function saveCanvasEditToStorage(settings: PersistedCanvasEditSettings): void {
  try {
    localStorage.setItem(
      CANVAS_EDIT_STORAGE_KEY,
      JSON.stringify(settings satisfies PersistedCanvasEditSettings),
    )
  } catch (err) {
    console.warn('[canvas-edit] failed to save settings', err)
  }
}

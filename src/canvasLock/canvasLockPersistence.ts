import { scopedStorageKey } from '../storage/storageScope'

export const CANVAS_LOCK_STORAGE_KEY = scopedStorageKey('cutline-canvas-lock-v1')

type PersistedLock = {
  isLocked: boolean
}

export function loadCanvasLockFromStorage(): boolean {
  try {
    const raw = localStorage.getItem(CANVAS_LOCK_STORAGE_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as PersistedLock
    return parsed.isLocked === true
  } catch {
    return false
  }
}

export function saveCanvasLockToStorage(isLocked: boolean): void {
  try {
    localStorage.setItem(
      CANVAS_LOCK_STORAGE_KEY,
      JSON.stringify({ isLocked } satisfies PersistedLock),
    )
  } catch (err) {
    console.warn('[canvas-lock] failed to save lock state', err)
  }
}

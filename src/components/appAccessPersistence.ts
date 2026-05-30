import { scopedStorageKey } from '../storage/storageScope'

export const APP_ACCESS_STORAGE_KEY = scopedStorageKey('cutline-app-access-v1')

/** Whether this device has been permanently unlocked past the access gate. */
export function loadAppAccessUnlocked(): boolean {
  try {
    return localStorage.getItem(APP_ACCESS_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function saveAppAccessUnlocked(): void {
  try {
    localStorage.setItem(APP_ACCESS_STORAGE_KEY, '1')
  } catch (err) {
    console.warn('[app-access] failed to persist unlock', err)
  }
}

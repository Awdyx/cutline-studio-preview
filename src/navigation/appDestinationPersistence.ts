import { scopedStorageKey } from '../storage/storageScope'
import type { AppDestination } from './appDestinationStore'

const LAST_APP_DESTINATION_KEY = scopedStorageKey('cutline-last-app-destination')

const VALID_DESTINATIONS: readonly AppDestination[] = [
  'studio',
  'leaderboard',
  'forum',
  'groups',
  'ucat',
]

export function loadLastAppDestination(): AppDestination {
  try {
    const raw = localStorage.getItem(LAST_APP_DESTINATION_KEY)
    if (raw && (VALID_DESTINATIONS as readonly string[]).includes(raw)) {
      return raw as AppDestination
    }
  } catch {
    // ignore
  }
  return 'studio'
}

export function saveLastAppDestination(destination: AppDestination): void {
  try {
    localStorage.setItem(LAST_APP_DESTINATION_KEY, destination)
  } catch {
    // ignore quota / private mode
  }
}

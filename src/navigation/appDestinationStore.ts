import { create } from 'zustand'
import {
  loadLastAppDestination,
  saveLastAppDestination,
} from './appDestinationPersistence'

export type AppDestination = 'studio' | 'leaderboard' | 'forum' | 'groups' | 'ucat'

export const APP_DESTINATION_LABELS: Record<AppDestination, string> = {
  studio: 'studio',
  leaderboard: 'rankings',
  forum: 'forum',
  groups: 'groups',
  ucat: 'ucat',
}

type AppDestinationState = {
  destination: AppDestination
  setDestination: (destination: AppDestination) => void
}

export const useAppDestinationStore = create<AppDestinationState>((set) => ({
  destination: loadLastAppDestination(),
  setDestination: (destination) => {
    set({ destination })
    saveLastAppDestination(destination)
  },
}))

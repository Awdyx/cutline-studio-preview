import { create } from 'zustand'

export type AppDestination = 'studio' | 'leaderboard' | 'forum' | 'groups' | 'ucat'

type AppDestinationState = {
  destination: AppDestination
  setDestination: (destination: AppDestination) => void
}

export const useAppDestinationStore = create<AppDestinationState>((set) => ({
  destination: 'studio',
  setDestination: (destination) => set({ destination }),
}))

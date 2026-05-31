import { create } from 'zustand'

export type AppDestination = 'studio'

export const APP_DESTINATION_LABELS: Record<AppDestination, string> = {
  studio: 'studio',
}

type AppDestinationState = {
  destination: AppDestination
  setDestination: (destination: AppDestination) => void
}

export const useAppDestinationStore = create<AppDestinationState>((set) => ({
  destination: 'studio',
  setDestination: (destination) => set({ destination }),
}))

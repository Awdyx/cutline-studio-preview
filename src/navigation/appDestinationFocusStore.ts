import { create } from 'zustand'
import type { SpaceCamera } from '../spaces/types'
import type { AppDestination } from './appDestinationStore'

type AppDestinationFocusState = {
  panLocked: boolean
  /** True once the fly-to camera has landed — gates the focused plate chrome. */
  focusRevealed: boolean
  dismissing: boolean
  activeDestination: AppDestination | null
  returnCamera: SpaceCamera | null
  armFocus: (destination: AppDestination, returnCamera: SpaceCamera) => void
  revealFocus: () => void
  setDismissing: (dismissing: boolean) => void
  clearFocus: () => void
}

export const useAppDestinationFocusStore = create<AppDestinationFocusState>(
  (set, get) => ({
    panLocked: false,
    focusRevealed: false,
    dismissing: false,
    activeDestination: null,
    returnCamera: null,
    armFocus: (destination, returnCamera) => {
      if (!get().panLocked) {
        set({
          panLocked: true,
          focusRevealed: false,
          dismissing: false,
          activeDestination: destination,
          returnCamera,
        })
        return
      }
      set({
        activeDestination: destination,
        focusRevealed: false,
        dismissing: false,
      })
    },
    revealFocus: () => {
      if (!get().panLocked || get().dismissing) return
      if (get().focusRevealed) return
      set({ focusRevealed: true })
    },
    setDismissing: (dismissing) =>
      set({ dismissing, focusRevealed: dismissing ? false : get().focusRevealed }),
    clearFocus: () =>
      set({
        panLocked: false,
        focusRevealed: false,
        dismissing: false,
        activeDestination: null,
        returnCamera: null,
      }),
  }),
)

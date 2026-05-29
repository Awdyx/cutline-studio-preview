import { create } from 'zustand'
import { playSound } from '../sound/playSound'

interface SetEngagedOptions {
  /** Skip the transition SFX — used for programmatic camera moves (load, space entry). */
  silent?: boolean
}

interface CanvasFisheyeState {
  /** True while the zoomed-out fisheye overview is active (interactions locked). */
  engaged: boolean
  setEngaged: (engaged: boolean, options?: SetEngagedOptions) => void
}

export const useCanvasFisheyeStore = create<CanvasFisheyeState>((set, get) => ({
  engaged: false,
  setEngaged: (engaged, options) => {
    if (get().engaged === engaged) return
    set({ engaged })
    // Only user-driven zoom transitions are audible; programmatic moves stay silent.
    if (!options?.silent) {
      playSound(engaged ? 'fisheyeEnter' : 'fisheyeExit')
    }
  },
}))

import { create } from 'zustand'

interface CanvasOverviewState {
  /** True while the zoomed-out canvas overview is active. */
  engaged: boolean
  /** Enter/exit zoom animation in flight — relaxes transform scale limits. */
  transitioning: boolean
  setEngaged: (engaged: boolean) => void
  setTransitioning: (transitioning: boolean) => void
}

export const useCanvasOverviewStore = create<CanvasOverviewState>((set, get) => ({
  engaged: false,
  transitioning: false,
  setEngaged: (engaged) => {
    if (get().engaged === engaged) return
    set({ engaged })
  },
  setTransitioning: (transitioning) => {
    if (get().transitioning === transitioning) return
    set({ transitioning })
  },
}))


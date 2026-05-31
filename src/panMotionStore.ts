import { create } from 'zustand'

interface PanMotionState {
  zoomActive: boolean
  canvasPanActive: boolean
  setZoomActive: (active: boolean) => void
  setCanvasPanActive: (active: boolean) => void
}

export const usePanMotionStore = create<PanMotionState>((set, get) => ({
  zoomActive: false,
  canvasPanActive: false,

  setZoomActive: (active: boolean) => {
    if (get().zoomActive === active) return
    set({ zoomActive: active })
  },

  setCanvasPanActive: (active: boolean) => {
    if (get().canvasPanActive === active) return
    set({ canvasPanActive: active })
  },
}))

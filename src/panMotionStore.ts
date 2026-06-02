import { create } from 'zustand'

const VEL_EPS = 0.001

interface PanMotionState {
  zoomActive: boolean
  canvasPanActive: boolean
  vx: number
  vy: number
  setZoomActive: (active: boolean) => void
  setCanvasPanActive: (active: boolean) => void
  setPanVelocity: (vx: number, vy: number) => void
  clearPanVelocity: () => void
}

export const usePanMotionStore = create<PanMotionState>((set, get) => ({
  zoomActive: false,
  canvasPanActive: false,
  vx: 0,
  vy: 0,

  setZoomActive: (active: boolean) => {
    if (get().zoomActive === active) return
    set({ zoomActive: active })
  },

  setCanvasPanActive: (active: boolean) => {
    if (get().canvasPanActive === active) return
    set({ canvasPanActive: active })
  },

  setPanVelocity: (vx: number, vy: number) => {
    const s = get()
    if (
      Math.abs(s.vx - vx) < VEL_EPS &&
      Math.abs(s.vy - vy) < VEL_EPS
    ) {
      return
    }
    set({ vx, vy })
  },

  clearPanVelocity: () => {
    const s = get()
    if (s.vx === 0 && s.vy === 0) return
    set({ vx: 0, vy: 0 })
  },
}))

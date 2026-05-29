import { create } from 'zustand'

type CanvasStudioViewportZoneState = {
  /** Viewport centre is inside the studio ramp zone on the main canvas. */
  nearStudioViewport: boolean
  setNearStudioViewport: (near: boolean) => void
}

export const useCanvasStudioViewportZoneStore = create<CanvasStudioViewportZoneState>(
  (set) => ({
    nearStudioViewport: true,
    setNearStudioViewport: (nearStudioViewport) => set({ nearStudioViewport }),
  }),
)

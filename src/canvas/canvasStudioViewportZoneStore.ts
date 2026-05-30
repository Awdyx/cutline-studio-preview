import { create } from 'zustand'
import type { AppDestination } from '../navigation/appDestinationStore'

type CanvasStudioViewportZoneState = {
  /** Viewport centre is inside a plate focus zone on the main canvas. */
  nearStudioViewport: boolean
  /** Plate under the viewport centre, when {@link nearStudioViewport} is true. */
  viewportPlate: AppDestination | null
  setViewportZone: (near: boolean, plate: AppDestination | null) => void
}

export const useCanvasStudioViewportZoneStore = create<CanvasStudioViewportZoneState>(
  (set) => ({
    nearStudioViewport: false,
    viewportPlate: null,
    setViewportZone: (nearStudioViewport, viewportPlate) =>
      set((state) => {
        if (
          state.nearStudioViewport === nearStudioViewport &&
          state.viewportPlate === viewportPlate
        ) {
          return state
        }
        return { nearStudioViewport, viewportPlate }
      }),
  }),
)

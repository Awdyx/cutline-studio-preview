import { create } from 'zustand'
import type { FeaturePlateDestination } from './canvasPlate'

/** True while studio-centre hold/drag is armed — blocks viewport pan/zoom. */
type StudioCentreDragStoreState = {
  panSuppressed: boolean
  minimapDragging: boolean
  /** True while dragging the studio centre via handle or hold — hides reposition chrome. */
  studioCentreDragging: boolean
  /** Feature plate being dragged on the main canvas — hides that plate's reposition chrome. */
  featurePlateDragging: FeaturePlateDestination | null
  setPanSuppressed: (active: boolean) => void
  setMinimapDragging: (active: boolean) => void
  setStudioCentreDragging: (active: boolean) => void
  setFeaturePlateDragging: (dest: FeaturePlateDestination | null) => void
}

export const useStudioCentreDragStore = create<StudioCentreDragStoreState>((set) => ({
  panSuppressed: false,
  minimapDragging: false,
  studioCentreDragging: false,
  featurePlateDragging: null,
  setPanSuppressed: (panSuppressed) => set({ panSuppressed }),
  setMinimapDragging: (minimapDragging) => set({ minimapDragging }),
  setStudioCentreDragging: (studioCentreDragging) => set({ studioCentreDragging }),
  setFeaturePlateDragging: (featurePlateDragging) => set({ featurePlateDragging }),
}))

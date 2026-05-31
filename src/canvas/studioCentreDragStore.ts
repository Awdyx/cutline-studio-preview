import { create } from 'zustand'

type DragPreviewPosition = { x: number; y: number }

/** True while studio-centre hold/drag is armed — blocks viewport pan/zoom. */
type StudioCentreDragStoreState = {
  panSuppressed: boolean
  minimapDragging: boolean
  /** True while dragging the studio centre via handle or hold — hides reposition chrome. */
  studioCentreDragging: boolean
  /** Live canvas position while a plate drag transform is active — for viewport focus sync. */
  studioDragPreview: DragPreviewPosition | null
  setPanSuppressed: (active: boolean) => void
  setMinimapDragging: (active: boolean) => void
  setStudioCentreDragging: (active: boolean) => void
  setStudioDragPreview: (preview: DragPreviewPosition | null) => void
}

export const useStudioCentreDragStore = create<StudioCentreDragStoreState>((set) => ({
  panSuppressed: false,
  minimapDragging: false,
  studioCentreDragging: false,
  studioDragPreview: null,
  setPanSuppressed: (panSuppressed) => set({ panSuppressed }),
  setMinimapDragging: (minimapDragging) => set({ minimapDragging }),
  setStudioCentreDragging: (studioCentreDragging) => set({ studioCentreDragging }),
  setStudioDragPreview: (studioDragPreview) => set({ studioDragPreview }),
}))

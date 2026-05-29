import { create } from 'zustand'

type CanvasMinimapState = {
  expandedOpen: boolean
  /** Shown above the expanded map when opened via the studio reposition control. */
  repositionHintOpen: boolean
  setExpandedOpen: (open: boolean) => void
  setRepositionHintOpen: (open: boolean) => void
}

/** Expanded fisheye canvas map — boosted trackpad pan everywhere while open. */
export const useCanvasMinimapStore = create<CanvasMinimapState>((set) => ({
  expandedOpen: false,
  repositionHintOpen: false,
  setExpandedOpen: (expandedOpen) => set({ expandedOpen }),
  setRepositionHintOpen: (repositionHintOpen) => set({ repositionHintOpen }),
}))

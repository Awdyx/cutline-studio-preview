import { create } from 'zustand'
import type { CanvasItem } from '../canvasItems/types'

type SpaceDropHover = {
  spaceId: string
  ghostItem: CanvasItem
}

type SpaceDropState = {
  hover: SpaceDropHover | null
  confirmPulseSpaceId: string | null
  confirmPulseNonce: number
  setHover: (hover: SpaceDropHover | null) => void
  pulseConfirm: (spaceId: string) => void
  clearHover: () => void
  clearAll: () => void
}

export const useSpaceDropStore = create<SpaceDropState>((set) => ({
  hover: null,
  confirmPulseSpaceId: null,
  confirmPulseNonce: 0,

  setHover: (hover) => set({ hover }),

  pulseConfirm: (spaceId) =>
    set((state) => ({
      confirmPulseSpaceId: spaceId,
      confirmPulseNonce: state.confirmPulseNonce + 1,
    })),

  clearHover: () =>
    set({
      hover: null,
      confirmPulseSpaceId: null,
    }),

  clearAll: () =>
    set({
      hover: null,
      confirmPulseSpaceId: null,
    }),
}))

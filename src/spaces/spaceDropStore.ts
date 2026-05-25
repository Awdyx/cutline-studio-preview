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
  absorbingItemId: string | null
  absorbSpaceId: string | null
  enteringItemId: string | null
  setHover: (hover: SpaceDropHover | null) => void
  pulseConfirm: (spaceId: string) => void
  startAbsorb: (itemId: string, spaceId: string) => void
  markEnteringItem: (itemId: string) => void
  clearEnteringItem: () => void
  clearHover: () => void
  clearAbsorb: () => void
  clearAll: () => void
}

export const useSpaceDropStore = create<SpaceDropState>((set) => ({
  hover: null,
  confirmPulseSpaceId: null,
  confirmPulseNonce: 0,
  absorbingItemId: null,
  absorbSpaceId: null,
  enteringItemId: null,

  setHover: (hover) => set({ hover }),

  pulseConfirm: (spaceId) =>
    set((state) => ({
      confirmPulseSpaceId: spaceId,
      confirmPulseNonce: state.confirmPulseNonce + 1,
    })),

  startAbsorb: (itemId, spaceId) =>
    set({
      absorbingItemId: itemId,
      absorbSpaceId: spaceId,
    }),

  markEnteringItem: (itemId) => set({ enteringItemId: itemId }),

  clearEnteringItem: () => set({ enteringItemId: null }),

  clearHover: () =>
    set({
      hover: null,
      confirmPulseSpaceId: null,
    }),

  clearAbsorb: () =>
    set({
      absorbingItemId: null,
      absorbSpaceId: null,
    }),

  clearAll: () =>
    set({
      hover: null,
      confirmPulseSpaceId: null,
      absorbingItemId: null,
      absorbSpaceId: null,
    }),
}))

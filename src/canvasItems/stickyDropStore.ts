import { create } from 'zustand'
import type { ImageCanvasItem } from './types'

type StickyDropHover = {
  stickyId: string
  ghostItem: ImageCanvasItem
}

type StickyDropState = {
  hover: StickyDropHover | null
  confirmPulseStickyId: string | null
  confirmPulseNonce: number
  absorbingItemId: string | null
  absorbStickyId: string | null
  setHover: (hover: StickyDropHover | null) => void
  pulseConfirm: (stickyId: string) => void
  startAbsorb: (itemId: string, stickyId: string) => void
  clearHover: () => void
  clearAbsorb: () => void
  clearAll: () => void
}

export const useStickyDropStore = create<StickyDropState>((set) => ({
  hover: null,
  confirmPulseStickyId: null,
  confirmPulseNonce: 0,
  absorbingItemId: null,
  absorbStickyId: null,

  setHover: (hover) => set({ hover }),

  pulseConfirm: (stickyId) =>
    set((state) => ({
      confirmPulseStickyId: stickyId,
      confirmPulseNonce: state.confirmPulseNonce + 1,
    })),

  startAbsorb: (itemId, stickyId) =>
    set({
      absorbingItemId: itemId,
      absorbStickyId: stickyId,
    }),

  clearHover: () =>
    set({
      hover: null,
      confirmPulseStickyId: null,
    }),

  clearAbsorb: () =>
    set({
      absorbingItemId: null,
      absorbStickyId: null,
    }),

  clearAll: () =>
    set({
      hover: null,
      confirmPulseStickyId: null,
      absorbingItemId: null,
      absorbStickyId: null,
    }),
}))

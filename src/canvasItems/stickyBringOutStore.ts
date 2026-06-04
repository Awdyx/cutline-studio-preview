import { create } from 'zustand'

/** Canvas image fade-in after bring-out reparent. */
export const STICKY_BRING_OUT_FADE_MS = 160

type StickyBringOutState = {
  recentlyBroughtOutItemId: string | null
  recentlyBroughtOutNonce: number
  completeBringOut: (itemId: string) => void
  clearRecentlyBroughtOut: (itemId: string) => void
  clearAll: () => void
}

export const useStickyBringOutStore = create<StickyBringOutState>((set) => ({
  recentlyBroughtOutItemId: null,
  recentlyBroughtOutNonce: 0,

  completeBringOut: (itemId) =>
    set((state) => ({
      recentlyBroughtOutItemId: itemId,
      recentlyBroughtOutNonce: state.recentlyBroughtOutNonce + 1,
    })),

  clearRecentlyBroughtOut: (itemId) =>
    set((state) =>
      state.recentlyBroughtOutItemId === itemId
        ? { recentlyBroughtOutItemId: null }
        : state,
    ),

  clearAll: () => set({ recentlyBroughtOutItemId: null }),
}))

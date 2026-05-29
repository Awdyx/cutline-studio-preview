import { create } from 'zustand'

/** Embedded image peel-off before reparenting to the canvas. */
export const STICKY_BRING_OUT_MS = 300

/** Canvas image spring-in after reparenting. */
export const STICKY_BRING_OUT_ENTER_MS = 380

type StickyBringOutState = {
  bringingOutItemId: string | null
  bringOutStickyId: string | null
  recentlyBroughtOutItemId: string | null
  recentlyBroughtOutNonce: number
  beginBringOut: (itemId: string, stickyId: string) => void
  completeBringOut: (itemId: string) => void
  clearRecentlyBroughtOut: (itemId: string) => void
  clearAll: () => void
}

export const useStickyBringOutStore = create<StickyBringOutState>((set) => ({
  bringingOutItemId: null,
  bringOutStickyId: null,
  recentlyBroughtOutItemId: null,
  recentlyBroughtOutNonce: 0,

  beginBringOut: (itemId, stickyId) =>
    set({
      bringingOutItemId: itemId,
      bringOutStickyId: stickyId,
      recentlyBroughtOutItemId: null,
    }),

  completeBringOut: (itemId) =>
    set((state) => ({
      bringingOutItemId: null,
      bringOutStickyId: null,
      recentlyBroughtOutItemId: itemId,
      recentlyBroughtOutNonce: state.recentlyBroughtOutNonce + 1,
    })),

  clearRecentlyBroughtOut: (itemId) =>
    set((state) =>
      state.recentlyBroughtOutItemId === itemId
        ? { recentlyBroughtOutItemId: null }
        : state,
    ),

  clearAll: () =>
    set({
      bringingOutItemId: null,
      bringOutStickyId: null,
      recentlyBroughtOutItemId: null,
    }),
}))

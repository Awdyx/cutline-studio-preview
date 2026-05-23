import { create } from 'zustand'

type CanvasNavigationState = {
  /** Two or more fingers on the screen (pinch). */
  multiTouchActive: boolean
  setMultiTouchActive: (active: boolean) => void
  /** Ignore canvas background taps briefly after chrome actions (e.g. search pick). */
  suppressBackgroundSelectionClearUntil: number
  suppressBackgroundSelectionClear: (durationMs?: number) => void
  shouldSuppressBackgroundSelectionClear: () => boolean
  shouldSuppressItemTap: () => boolean
  /** Pinch / multi-finger navigation — block drag, resize, and tap chrome. */
  shouldSuppressHandleGesture: () => boolean
}

export const useCanvasNavigationStore = create<CanvasNavigationState>((set, get) => ({
  multiTouchActive: false,
  suppressBackgroundSelectionClearUntil: 0,

  setMultiTouchActive: (active) => set({ multiTouchActive: active }),

  suppressBackgroundSelectionClear: (durationMs = 600) => {
    set({
      suppressBackgroundSelectionClearUntil: Date.now() + durationMs,
    })
  },

  shouldSuppressBackgroundSelectionClear: () =>
    Date.now() < get().suppressBackgroundSelectionClearUntil,

  shouldSuppressItemTap: () => get().multiTouchActive,

  shouldSuppressHandleGesture: () => get().multiTouchActive,
}))

/**
 * Class-only selectors for react-zoom-pan-pinch `excluded` (it prefixes `.` — attribute
 * selectors like `[data-canvas-item]` break `Element.matches` and disable all pan/zoom).
 */
export const CANVAS_PAN_EXCLUDED = [
  'canvas-item-drag-handle',
  'canvas-item-resize-handle',
  'canvas-item-selected-focus',
  'space-preview-adjust',
] as const

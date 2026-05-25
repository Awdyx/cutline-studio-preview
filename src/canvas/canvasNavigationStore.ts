import { create } from 'zustand'

type CanvasNavigationState = {
  /** Two or more fingers on the screen (pinch). */
  multiTouchActive: boolean
  setMultiTouchActive: (active: boolean) => void
  /** Canvas pan burst (trackpad or touch) started outside a study hub — ignore widget hit-testing until it ends. */
  trackpadPanLockActive: boolean
  setTrackpadPanLock: (active: boolean) => void
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
  trackpadPanLockActive: false,
  suppressBackgroundSelectionClearUntil: 0,

  setMultiTouchActive: (active) => set({ multiTouchActive: active }),

  setTrackpadPanLock: (active) => {
    if (get().trackpadPanLockActive !== active) {
      set({ trackpadPanLockActive: active })
    }
    if (active) {
      document.documentElement.setAttribute('data-canvas-trackpad-pan-lock', '')
    } else {
      document.documentElement.removeAttribute('data-canvas-trackpad-pan-lock')
    }
  },

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
  'canvas-item-hold-drag-pending',
  'space-preview-adjust',
  'study-hub-scroll',
  'study-hub-practice',
  'study-hub-menu-dismiss',
  'profile-media-frame-editor',
] as const

const STUDY_HUB_PAN_EXCLUDED = new Set(['study-hub-scroll', 'study-hub-practice'])

/** Pan/zoom excluded classes — study hub scroll areas drop out while a canvas pan burst is locked. */
export function canvasPanExcludedClasses(trackpadPanLockActive: boolean): string[] {
  if (!trackpadPanLockActive) return [...CANVAS_PAN_EXCLUDED]
  return CANVAS_PAN_EXCLUDED.filter((cls) => !STUDY_HUB_PAN_EXCLUDED.has(cls))
}

import { create } from 'zustand'

type CanvasNavigationState = {
  /** Two or more fingers on the screen (pinch). */
  multiTouchActive: boolean
  setMultiTouchActive: (active: boolean) => void
  /** Ignore canvas background taps briefly after chrome actions (e.g. search pick). */
  suppressBackgroundSelectionClearUntil: number
  suppressBackgroundSelectionClear: (durationMs?: number) => void
  shouldSuppressBackgroundSelectionClear: () => boolean
  /** Block pocket open / item select briefly after dismiss-only outside taps. */
  suppressItemTapUntil: number
  suppressItemTap: (durationMs?: number) => void
  shouldSuppressItemTap: () => boolean
  /** Pinch / multi-finger navigation — block drag, resize, and tap chrome. */
  shouldSuppressHandleGesture: () => boolean
}

export const useCanvasNavigationStore = create<CanvasNavigationState>((set, get) => ({
  multiTouchActive: false,
  suppressBackgroundSelectionClearUntil: 0,
  suppressItemTapUntil: 0,

  setMultiTouchActive: (active) => set({ multiTouchActive: active }),

  suppressBackgroundSelectionClear: (durationMs = 600) => {
    set({
      suppressBackgroundSelectionClearUntil: Date.now() + durationMs,
    })
  },

  shouldSuppressBackgroundSelectionClear: () =>
    Date.now() < get().suppressBackgroundSelectionClearUntil,

  suppressItemTap: (durationMs = 450) => {
    set({ suppressItemTapUntil: Date.now() + durationMs })
  },

  shouldSuppressItemTap: () =>
    get().multiTouchActive || Date.now() < get().suppressItemTapUntil,

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
  'studio-centre-drag-handle',
  'studio-centre-drag-handle-wrapper',
  'studio-centre-hold-drag-pending',
  'study-hub-scroll',
  'study-hub-practice',
  'study-hub-menu-dismiss',
  'study-hub-scratch-pad',
  'study-hub-scratch-pad-viewport',
  'profile-media-frame-editor',
] as const

/**
 * Trackpad two-finger pan excluded classes — nodes listed here block trackpad pan
 * when the cursor sits over them. Drag/resize handles are omitted so pan still
 * works while hovering handles; selected item bodies are omitted so pan works
 * over a selected sticky/image too.
 */
export const CANVAS_TRACKPAD_PAN_EXCLUDED = [
  'study-hub-scroll',
  'study-hub-practice',
  'study-hub-menu-dismiss',
  'study-hub-scratch-pad',
  'study-hub-scratch-pad-viewport',
  'profile-media-frame-editor',
] as const

/** Study-hub surfaces that steal trackpad pan / wheel unless a canvas pan session is active. */
const STUDY_HUB_PAN_SURFACE_CLASSES = new Set<string>([
  'study-hub-scroll',
  'study-hub-practice',
  'study-hub-menu-dismiss',
  'study-hub-scratch-pad',
  'study-hub-scratch-pad-viewport',
])

export function canvasPanExcludedClasses(canvasPanActive = false): string[] {
  const all = [...CANVAS_PAN_EXCLUDED]
  if (!canvasPanActive) return all
  return all.filter((cls) => !STUDY_HUB_PAN_SURFACE_CLASSES.has(cls))
}

export function canvasTrackpadPanExcludedClasses(canvasPanActive = false): string[] {
  const all = [...CANVAS_TRACKPAD_PAN_EXCLUDED]
  if (!canvasPanActive) return all
  return all.filter((cls) => !STUDY_HUB_PAN_SURFACE_CLASSES.has(cls))
}

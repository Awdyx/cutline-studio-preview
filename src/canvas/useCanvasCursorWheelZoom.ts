import { useEffect, useRef, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  applyAnchoredWheelZoom,
  CANVAS_WHEEL_ZOOM_STEP,
} from './canvasCamera'
import { shouldBlockCanvasZoomForStudyHubMenuFocus } from '../canvasItems/studyHubMenuFocus'
import { CANVAS_PAN_SESSION_GAP_MS } from './studyHubPanScroll'
function isModifierWheelZoom(event: WheelEvent): boolean {
  return event.ctrlKey || event.metaKey
}

function isExcludedWheelTarget(
  target: EventTarget | null,
  excludedClasses: string[],
): boolean {
  if (!(target instanceof Element)) return false
  return excludedClasses.some((cls) => target.closest(`.${cls}`) != null)
}

function wrapperLocalAnchor(
  ref: ReactZoomPanPinchContentRef,
  event: WheelEvent,
): { x: number; y: number } | null {
  const wrapper = ref.instance.wrapperComponent
  if (!wrapper) return null
  const rect = wrapper.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

/** Trackpad pinch / modifier wheel zoom anchored to the cursor position. */
export function useCanvasCursorWheelZoom({
  transformRef,
  viewportRef,
  zoomExcluded,
  onZoom,
  onZoomStop,
  disabled = false,
  step = CANVAS_WHEEL_ZOOM_STEP,
}: {
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  viewportRef: RefObject<HTMLElement | null>
  /** Like trackpad pan exclusions — drag/resize handles must not block cursor zoom. */
  zoomExcluded: string[]
  onZoom: (ref: ReactZoomPanPinchContentRef) => void
  onZoomStop: (ref: ReactZoomPanPinchContentRef) => void
  disabled?: boolean
  step?: number
}) {
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || disabled) return

    function onWheel(event: WheelEvent) {
      if (!isModifierWheelZoom(event)) return

      // Always block browser page zoom for pinch gestures over the canvas.
      event.preventDefault()

      if (shouldBlockCanvasZoomForStudyHubMenuFocus(event.target)) {
        event.stopPropagation()
        return
      }

      if (isExcludedWheelTarget(event.target, zoomExcluded)) return

      const ref = transformRef.current
      if (!ref || ref.instance.setup.disabled || ref.instance.setup.wheel.disabled) {
        return
      }

      event.stopPropagation()

      const anchor = wrapperLocalAnchor(ref, event)
      if (!applyAnchoredWheelZoom(ref, event.deltaY, anchor, step)) return

      onZoom(ref)

      if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
      stopTimerRef.current = setTimeout(() => {
        stopTimerRef.current = null
        const live = transformRef.current
        if (live) onZoomStop(live)
      }, CANVAS_PAN_SESSION_GAP_MS)
    }

    viewport.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => {
      viewport.removeEventListener('wheel', onWheel, { capture: true })
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current)
        stopTimerRef.current = null
      }
    }
  }, [transformRef, viewportRef, zoomExcluded, onZoom, onZoomStop, disabled, step])
}

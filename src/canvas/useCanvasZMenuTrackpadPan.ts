import { useEffect, useRef, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { applyCanvasTrackpadPanDelta } from './canvasCamera'
import { isPointInClientRect } from '../canvasItems/canvasItemViewportVisibility'
import {
  CANVAS_PAN_SESSION_GAP_MS,
  isTrackpadPanWheel,
} from './studyHubPanScroll'

type Options = {
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  disabled?: boolean
  onPanFrame?: (ref: ReactZoomPanPinchContentRef) => void
  onPanStop?: (ref: ReactZoomPanPinchContentRef) => void
}

/**
 * Forwards trackpad pan when the cursor sits over the fixed z-order menu, which
 * lives outside the transform wrapper and would otherwise swallow wheel events.
 */
export function useCanvasZMenuTrackpadPan({
  transformRef,
  disabled = false,
  onPanFrame,
  onPanStop,
}: Options) {
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (disabled) return

    function finishPan(ref: ReactZoomPanPinchContentRef) {
      onPanStop?.(ref)
    }

    function onWheel(event: WheelEvent) {
      if (!isTrackpadPanWheel(event)) return

      const menu = document.querySelector('[data-canvas-item-z-menu]')
      if (!(menu instanceof HTMLElement)) return
      if (!isPointInClientRect(event.clientX, event.clientY, menu.getBoundingClientRect())) {
        return
      }

      const ref = transformRef.current
      if (!ref || ref.instance.setup.disabled || ref.instance.setup.trackPadPanning.disabled) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (!applyCanvasTrackpadPanDelta(ref, event.deltaX, event.deltaY)) return

      onPanFrame?.(ref)

      if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
      stopTimerRef.current = setTimeout(() => {
        stopTimerRef.current = null
        finishPan(ref)
      }, CANVAS_PAN_SESSION_GAP_MS)
    }

    window.addEventListener('wheel', onWheel, { capture: true, passive: false })
    return () => {
      window.removeEventListener('wheel', onWheel, true)
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current)
        stopTimerRef.current = null
      }
    }
  }, [disabled, onPanFrame, onPanStop, transformRef])
}

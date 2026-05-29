import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { applyCanvasTrackpadPanDelta } from './canvasCamera'
import { canvasMinimapTrackpadPanBoost } from './canvasMinimapGeometry'
import { useCanvasMinimapStore } from './canvasMinimapStore'
import {
  CANVAS_PAN_SESSION_GAP_MS,
  isTrackpadPanWheel,
} from './studyHubPanScroll'

function isExcludedWheelTarget(
  target: EventTarget | null,
  excludedClasses: string[],
): boolean {
  if (!(target instanceof Element)) return false
  return excludedClasses.some((cls) => target.closest(`.${cls}`) != null)
}

type Options = {
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  disabled?: boolean
  excluded?: string[]
  onPanFrame?: (ref: ReactZoomPanPinchContentRef) => void
  onPanStop?: (ref: ReactZoomPanPinchContentRef) => void
}

/**
 * Boosted trackpad pan anywhere on screen while the expanded minimap menu is open.
 * Normal library trackpad pan is disabled during that time to avoid double-handling.
 */
export function useCanvasMinimapTrackpadPan({
  transformRef,
  disabled = false,
  excluded = [],
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
      if (!useCanvasMinimapStore.getState().expandedOpen) return
      if (!isTrackpadPanWheel(event)) return
      if (isExcludedWheelTarget(event.target, excluded)) return

      const ref = transformRef.current
      if (!ref || ref.instance.setup.disabled) return

      event.preventDefault()
      event.stopPropagation()

      const boost = canvasMinimapTrackpadPanBoost()
      if (
        !applyCanvasTrackpadPanDelta(ref, event.deltaX, event.deltaY, boost)
      ) {
        return
      }

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
  }, [disabled, excluded, onPanFrame, onPanStop, transformRef])
}

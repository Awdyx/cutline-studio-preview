import { useCallback, useEffect, useRef } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { clampToLibraryBounds } from './canvasCamera'
import { CANVAS_PAN_SESSION_GAP_MS } from './studyHubPanScroll'
import { usePanMotionStore } from '../panMotionStore'

/**
 * Trackpad / drag pan bursts do not always emit a final onPanningStop from the
 * zoom-pan-pinch library. Debounce the stop path so canvasPanActive and
 * data-canvas-panning always clear without needing a tap.
 */
export function useCanvasPanSession() {
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRefRef = useRef<ReactZoomPanPinchContentRef | null>(null)

  const finishPanSession = useCallback(
    (ref: ReactZoomPanPinchContentRef, clamp = true) => {
      usePanMotionStore.getState().setCanvasPanActive(false)
      if (clamp) clampToLibraryBounds(ref)
    },
    [],
  )

  const clearStopTimer = useCallback(() => {
    if (stopTimerRef.current != null) {
      clearTimeout(stopTimerRef.current)
      stopTimerRef.current = null
    }
  }, [])

  const schedulePanSessionStop = useCallback(
    (ref: ReactZoomPanPinchContentRef, clamp = true) => {
      lastRefRef.current = ref
      clearStopTimer()
      stopTimerRef.current = setTimeout(() => {
        stopTimerRef.current = null
        const live = lastRefRef.current
        if (live) finishPanSession(live, clamp)
      }, CANVAS_PAN_SESSION_GAP_MS)
    },
    [clearStopTimer, finishPanSession],
  )

  const onPanFrame = useCallback(
    (ref: ReactZoomPanPinchContentRef) => {
      usePanMotionStore.getState().setCanvasPanActive(true)
      schedulePanSessionStop(ref)
    },
    [schedulePanSessionStop],
  )

  const onPanStop = useCallback(
    (ref: ReactZoomPanPinchContentRef, clamp = true) => {
      clearStopTimer()
      finishPanSession(ref, clamp)
    },
    [clearStopTimer, finishPanSession],
  )

  useEffect(() => clearStopTimer, [clearStopTimer])

  return { onPanFrame, onPanStop }
}

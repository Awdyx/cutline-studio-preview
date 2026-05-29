import { useCallback, useEffect, useRef } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  cancelZoomSnapAnimation,
  computeZoomEdgeVignetteStrength,
  isBeyondHardZoomMin,
  needsZoomSnapBack,
  snapZoomToHardLimits,
  ZOOM_SNAP_BACK_MS,
  ZOOM_SNAP_BACK_MIN_MS,
} from './canvasZoomEdgeEase'
import { usePanMotionStore } from '../panMotionStore'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'

export function useCanvasZoomEdgeEase(minScale: number) {
  const prevScaleRef = useRef<number | null>(null)
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeRafRef = useRef<number | null>(null)
  const setZoomEdgeStrength = usePanMotionStore((s) => s.setZoomEdgeStrength)

  const clearSnapTimer = useCallback(() => {
    if (snapTimerRef.current) {
      clearTimeout(snapTimerRef.current)
      snapTimerRef.current = null
    }
  }, [])

  const stopFadeLoop = useCallback(() => {
    if (fadeRafRef.current !== null) {
      cancelAnimationFrame(fadeRafRef.current)
      fadeRafRef.current = null
    }
  }, [])

  const fadeZoomVignette = useCallback(() => {
    stopFadeLoop()
    let strength = usePanMotionStore.getState().zoomEdgeStrength
    const tick = () => {
      strength *= 0.82
      if (strength < 0.02) {
        setZoomEdgeStrength(0)
        fadeRafRef.current = null
        return
      }
      setZoomEdgeStrength(strength)
      fadeRafRef.current = requestAnimationFrame(tick)
    }
    fadeRafRef.current = requestAnimationFrame(tick)
  }, [setZoomEdgeStrength, stopFadeLoop])

  const onZoomMotion = useCallback(
    (ref: ReactZoomPanPinchContentRef) => {
      clearSnapTimer()
      stopFadeLoop()
      cancelZoomSnapAnimation()

      const { scale } = ref.state
      const prev = prevScaleRef.current ?? scale
      const delta = scale - prev
      prevScaleRef.current = scale

      const strength = computeZoomEdgeVignetteStrength(scale, delta, minScale)
      setZoomEdgeStrength(strength)
    },
    [minScale, setZoomEdgeStrength, clearSnapTimer, stopFadeLoop],
  )

  const onZoomStop = useCallback(
    (ref: ReactZoomPanPinchContentRef) => {
      prevScaleRef.current = ref.state.scale
      fadeZoomVignette()

      clearSnapTimer()
      if (
        !useCanvasItemsStore.getState().menuFocusReturnCamera &&
        needsZoomSnapBack(ref.state.scale, minScale)
      ) {
        const snapMs = isBeyondHardZoomMin(ref.state.scale, minScale)
          ? ZOOM_SNAP_BACK_MIN_MS
          : ZOOM_SNAP_BACK_MS
        snapZoomToHardLimits(ref, minScale)
        snapTimerRef.current = setTimeout(() => {
          snapTimerRef.current = null
          useCanvasWorkspaceStore.getState().syncMainCamera(ref)
          useCanvasWorkspaceStore.getState().flushPersistWorkspace()
        }, snapMs + 32)
        return
      }

      useCanvasWorkspaceStore.getState().syncMainCamera(ref)
    },
    [minScale, fadeZoomVignette, clearSnapTimer],
  )

  useEffect(
    () => () => {
      clearSnapTimer()
      stopFadeLoop()
      cancelZoomSnapAnimation()
      setZoomEdgeStrength(0)
    },
    [clearSnapTimer, stopFadeLoop, setZoomEdgeStrength],
  )

  return { onZoom: onZoomMotion, onPinch: onZoomMotion, onZoomStop }
}

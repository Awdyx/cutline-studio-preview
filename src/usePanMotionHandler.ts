import { useCallback, useEffect, useRef } from 'react'
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import {
  computePanVignetteEdges,
  EDGE_HOLD_MOTION_EPS,
  resetPanVignetteRuntime,
  shouldContinueHoldFade,
  shouldRunHoldFadeLoop,
  stepPanVignetteHoldFade,
} from './canvasPanVignette'
import { usePanMotionStore } from './panMotionStore'

const PAN_STOP_DEBOUNCE_MS = 100

export function usePanMotionHandler() {
  const prevPos = useRef({ x: 0, y: 0 })
  const initialized = useRef(false)
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeRaf = useRef<number | null>(null)
  const fadeRef = useRef<ReactZoomPanPinchRef | null>(null)
  // Pending RAF for throttling pan-frame updates
  const panRaf = useRef<number | null>(null)
  const pendingSync = useRef<{ ref: ReactZoomPanPinchRef; dx: number; dy: number } | null>(null)

  const setPanFrame = usePanMotionStore((s) => s.setPanFrame)
  const setEdges = usePanMotionStore((s) => s.setEdges)
  const setPanStopped = usePanMotionStore((s) => s.setPanStopped)

  const stopHoldFadeLoop = useCallback(() => {
    if (fadeRaf.current !== null) {
      cancelAnimationFrame(fadeRaf.current)
      fadeRaf.current = null
    }
    fadeRef.current = null
  }, [])

  const runHoldFadeLoop = useCallback(
    (ref: ReactZoomPanPinchRef) => {
      fadeRef.current = ref
      if (fadeRaf.current !== null) return

      const tick = () => {
        const liveRef = fadeRef.current
        if (!liveRef) {
          fadeRaf.current = null
          return
        }

        const edges = stepPanVignetteHoldFade(liveRef)
        setEdges(edges)

        if (shouldContinueHoldFade(liveRef, edges)) {
          fadeRaf.current = requestAnimationFrame(tick)
          return
        }

        fadeRaf.current = null
      }

      fadeRaf.current = requestAnimationFrame(tick)
    },
    [setEdges],
  )

  const flushPanSync = useCallback(
    (ref: ReactZoomPanPinchRef, vx: number, vy: number) => {
      const edges = computePanVignetteEdges(ref, vx, vy)
      setPanFrame(vx, vy, edges)

      const intentional =
        Math.abs(vx) > EDGE_HOLD_MOTION_EPS ||
        Math.abs(vy) > EDGE_HOLD_MOTION_EPS
      if (intentional) {
        stopHoldFadeLoop()
        return
      }

      if (shouldRunHoldFadeLoop(ref, edges, vx, vy)) {
        runHoldFadeLoop(ref)
      }
    },
    [setPanFrame, runHoldFadeLoop, stopHoldFadeLoop],
  )

  const syncPanMotion = useCallback(
    (ref: ReactZoomPanPinchRef, vx: number, vy: number) => {
      // Accumulate the latest values; a single RAF flush applies them once per frame.
      pendingSync.current = { ref, dx: vx, dy: vy }
      if (panRaf.current !== null) return
      panRaf.current = requestAnimationFrame(() => {
        panRaf.current = null
        if (!pendingSync.current) return
        const { ref: r, dx, dy } = pendingSync.current
        pendingSync.current = null
        flushPanSync(r, dx, dy)
      })
    },
    [flushPanSync],
  )

  const onPanning = useCallback(
    (ref: ReactZoomPanPinchRef) => {
      const { positionX, positionY } = ref.state

      if (!initialized.current) {
        prevPos.current = { x: positionX, y: positionY }
        initialized.current = true
        return
      }

      const dx = positionX - prevPos.current.x
      const dy = positionY - prevPos.current.y
      prevPos.current = { x: positionX, y: positionY }

      syncPanMotion(ref, dx, dy)

      if (stopTimer.current) clearTimeout(stopTimer.current)
      stopTimer.current = setTimeout(() => {
        stopHoldFadeLoop()
        resetPanVignetteRuntime()
        setPanStopped()
      }, PAN_STOP_DEBOUNCE_MS)
    },
    [syncPanMotion, setPanStopped, stopHoldFadeLoop],
  )

  const onPanningStop = useCallback(
    (ref: ReactZoomPanPinchRef) => {
      // Cancel any pending RAF and flush immediately with zero velocity.
      if (panRaf.current !== null) {
        cancelAnimationFrame(panRaf.current)
        panRaf.current = null
        pendingSync.current = null
      }
      if (stopTimer.current) clearTimeout(stopTimer.current)
      stopHoldFadeLoop()
      resetPanVignetteRuntime()
      flushPanSync(ref, 0, 0)
      setPanStopped()
    },
    [flushPanSync, setPanStopped, stopHoldFadeLoop],
  )

  useEffect(
    () => () => {
      stopHoldFadeLoop()
      if (panRaf.current !== null) cancelAnimationFrame(panRaf.current)
    },
    [stopHoldFadeLoop],
  )

  return { onPanning, onPanningStop }
}

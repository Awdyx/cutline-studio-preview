import { useEffect, useRef, useState, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  computePanVignetteEdges,
  PAN_MOTION_EPS,
  stepPanVignetteHoldFade,
  vignetteIsVisible,
  type EdgeStrengths,
} from '../canvasPanVignette'
import { usePanMotionStore } from '../panMotionStore'
import {
  IDLE_MINIMAP_VIEWPORT_SQUISH,
  squishFromEdgePressures,
  stepMinimapViewportSquish,
  type MinimapViewportSquish,
} from './canvasMinimapViewportSquish'

function squishTargetFromEdges(
  edges: EdgeStrengths,
  panning: boolean,
): MinimapViewportSquish {
  return panning || vignetteIsVisible(edges)
    ? squishFromEdgePressures(edges)
    : IDLE_MINIMAP_VIEWPORT_SQUISH
}

function isOverviewVoidPan(): boolean {
  return (
    usePanMotionStore.getState().canvasPanActive &&
    !document.documentElement.hasAttribute('data-studio-centre-dragging')
  )
}

/**
 * Smooth rubber-band squish on the minimap viewport while the camera
 * is pushed against canvas bounds.
 */
export function useCanvasMinimapViewportSquish(
  active: boolean,
  reduceMotion: boolean | null,
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
): MinimapViewportSquish {
  const [squish, setSquish] = useState(IDLE_MINIMAP_VIEWPORT_SQUISH)
  const smoothRef = useRef(IDLE_MINIMAP_VIEWPORT_SQUISH)
  const prevPosRef = useRef({ x: 0, y: 0 })
  const posInitRef = useRef(false)
  const lastEdgesRef = useRef<EdgeStrengths>({
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  })
  const loopRunningRef = useRef(false)
  const rafRef = useRef(0)

  useEffect(() => {
    if (!active || reduceMotion) {
      loopRunningRef.current = false
      cancelAnimationFrame(rafRef.current)
      smoothRef.current = IDLE_MINIMAP_VIEWPORT_SQUISH
      setSquish(IDLE_MINIMAP_VIEWPORT_SQUISH)
      posInitRef.current = false
      return
    }

    const tick = () => {
      if (!loopRunningRef.current) return

      if (isOverviewVoidPan()) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      let edges: EdgeStrengths
      let panning = false

      const ref = transformRef.current
      if (!ref?.state) {
        edges = lastEdgesRef.current
      } else {
        const { positionX, positionY } = ref.state
        if (!posInitRef.current) {
          prevPosRef.current = { x: positionX, y: positionY }
          posInitRef.current = true
        }

        const vx = positionX - prevPosRef.current.x
        const vy = positionY - prevPosRef.current.y
        prevPosRef.current = { x: positionX, y: positionY }

        const moving =
          Math.abs(vx) > PAN_MOTION_EPS || Math.abs(vy) > PAN_MOTION_EPS

        if (moving) {
          panning = true
          edges = computePanVignetteEdges(ref, vx, vy)
        } else if (vignetteIsVisible(lastEdgesRef.current)) {
          edges = stepPanVignetteHoldFade(ref)
        } else {
          edges = computePanVignetteEdges(ref, vx, vy)
        }

        lastEdgesRef.current = edges
      }

      const target = squishTargetFromEdges(edges, panning)
      const next = stepMinimapViewportSquish(smoothRef.current, target)
      if (next !== smoothRef.current) {
        smoothRef.current = next
        setSquish(next)
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    const startLoop = () => {
      if (loopRunningRef.current) return
      loopRunningRef.current = true
      rafRef.current = requestAnimationFrame(tick)
    }

    const stopLoop = () => {
      loopRunningRef.current = false
      cancelAnimationFrame(rafRef.current)
    }

    startLoop()

    let wasVoidPan = isOverviewVoidPan()
    const unsub = usePanMotionStore.subscribe(() => {
      const voidPan = isOverviewVoidPan()
      if (voidPan && !wasVoidPan) {
        stopLoop()
      } else if (!voidPan && wasVoidPan) {
        startLoop()
      }
      wasVoidPan = voidPan
    })

    return () => {
      unsub()
      stopLoop()
      posInitRef.current = false
    }
  }, [active, reduceMotion, transformRef])

  return squish
}

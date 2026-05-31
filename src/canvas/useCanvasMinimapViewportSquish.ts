import { useEffect, useRef, useState, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  computePanVignetteEdges,
  PAN_MOTION_EPS,
  stepPanVignetteHoldFade,
  vignetteIsVisible,
  type EdgeStrengths,
} from '../canvasPanVignette'
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

  useEffect(() => {
    if (!active || reduceMotion) {
      smoothRef.current = IDLE_MINIMAP_VIEWPORT_SQUISH
      setSquish(IDLE_MINIMAP_VIEWPORT_SQUISH)
      posInitRef.current = false
      return
    }

    let raf = 0

    const tick = () => {
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

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      posInitRef.current = false
    }
  }, [active, reduceMotion, transformRef])

  return squish
}

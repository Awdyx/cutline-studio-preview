import { useEffect, useRef, useState } from 'react'
import { vignetteIsVisible } from '../canvasPanVignette'
import { usePanMotionStore } from '../panMotionStore'
import {
  IDLE_MINIMAP_VIEWPORT_SQUISH,
  squishFromEdgePressures,
  stepMinimapViewportSquish,
  type MinimapViewportSquish,
} from './canvasMinimapViewportSquish'

/**
 * Smooth rubber-band squish on the expanded minimap viewport while the camera
 * is pushed against canvas bounds (reuses pan vignette edge pressures).
 */
export function useCanvasMinimapViewportSquish(
  active: boolean,
  reduceMotion: boolean | null,
): MinimapViewportSquish {
  const [squish, setSquish] = useState(IDLE_MINIMAP_VIEWPORT_SQUISH)
  const smoothRef = useRef(IDLE_MINIMAP_VIEWPORT_SQUISH)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!active || reduceMotion) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      smoothRef.current = IDLE_MINIMAP_VIEWPORT_SQUISH
      setSquish(IDLE_MINIMAP_VIEWPORT_SQUISH)
      return
    }

    const tick = () => {
      const { edges, active: panning } = usePanMotionStore.getState()
      const target =
        panning || vignetteIsVisible(edges)
          ? squishFromEdgePressures(edges)
          : IDLE_MINIMAP_VIEWPORT_SQUISH

      const next = stepMinimapViewportSquish(smoothRef.current, target)
      smoothRef.current = next
      setSquish(next)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [active, reduceMotion])

  return squish
}

import { useEffect, useState, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  readCanvasMinimapViewport,
  type CanvasMinimapRect,
} from './canvasMinimapGeometry'

function minimapRectsEqual(
  a: CanvasMinimapRect | null,
  b: CanvasMinimapRect | null,
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
  )
}

/** Live viewport rect on the full canvas while navigation minimap is shown. */
export function useCanvasMinimapViewport(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  viewportRef: RefObject<HTMLElement | null>,
  active: boolean,
): CanvasMinimapRect | null {
  const [viewport, setViewport] = useState<CanvasMinimapRect | null>(null)

  useEffect(() => {
    if (!active) {
      setViewport(null)
      return
    }

    let raf = 0

    const tick = () => {
      const ref = transformRef.current
      const wrapper =
        viewportRef.current ?? ref?.instance.wrapperComponent ?? null
      const width = wrapper?.clientWidth ?? 0
      const height = wrapper?.clientHeight ?? 0
      const next = readCanvasMinimapViewport(ref, width, height)

      setViewport((prev) => (minimapRectsEqual(prev, next) ? prev : next))
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    window.addEventListener('resize', tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', tick)
    }
  }, [active, transformRef, viewportRef])

  return viewport
}

import { useEffect, useState, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  readCanvasMinimapViewport,
  type CanvasMinimapRect,
} from './canvasMinimapGeometry'

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
      setViewport(readCanvasMinimapViewport(ref, width, height))
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, transformRef, viewportRef])

  return viewport
}

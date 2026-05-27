import { useEffect, useState, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { canvasItemClientRect } from '../spaces/spaceCardRect'

function rectsEqual(a: DOMRect | null, b: DOMRect | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.left === b.left &&
    a.top === b.top &&
    a.width === b.width &&
    a.height === b.height
  )
}

/** Tracks a canvas item's screen rect every frame while active (follows pan/zoom animations). */
export function useCanvasItemScreenRect(
  item: { x: number; y: number; width: number; height: number },
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  active: boolean,
): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!active) {
      setRect(null)
      return
    }

    let raf = 0
    const tick = () => {
      const next = canvasItemClientRect(item, transformRef.current)
      setRect((prev) => (rectsEqual(prev, next) ? prev : next))
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, item.x, item.y, item.width, item.height, transformRef])

  return rect
}

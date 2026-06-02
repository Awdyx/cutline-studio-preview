import { useEffect, useState, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { studyHubMenuFocusScreenRect } from '../canvas/canvasCamera'
import { canvasItemLiveClientRect } from '../spaces/spaceCardRect'

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
  item: { id: string; x: number; y: number; width: number; height: number },
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
      const next = canvasItemLiveClientRect(item, transformRef.current)
      setRect((prev) => (rectsEqual(prev, next) ? prev : next))
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, item.id, item.x, item.y, item.width, item.height, transformRef])

  return rect
}

/** Tracks the fixed menu-focus screen frame (no canvas pan/zoom coupling). */
export function useStudyHubMenuFocusScreenRect(
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
      const next = studyHubMenuFocusScreenRect(transformRef.current)
      setRect((prev) => (rectsEqual(prev, next) ? prev : next))
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, transformRef])

  return rect
}

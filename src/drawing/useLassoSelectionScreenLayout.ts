import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { lassoSelectionScreenBounds, type ScreenRect } from './lassoGeometry'
import { useLassoStore } from './useLassoStore'
import { useStrokesStore } from './strokesStore'

export type LassoSelectionScreenLayout = ScreenRect

function layoutsEqual(a: ScreenRect, b: ScreenRect): boolean {
  return (
    a.left === b.left &&
    a.top === b.top &&
    a.right === b.right &&
    a.bottom === b.bottom
  )
}

/** Live screen bounds for lasso chrome — tracks pan/zoom via rAF. */
export function useLassoSelectionScreenLayout(
  canvasRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  selectedStrokeIds: readonly string[],
  selectedItemIds: readonly string[],
): LassoSelectionScreenLayout | null {
  const [layout, setLayout] = useState<LassoSelectionScreenLayout | null>(null)
  const lastLayoutRef = useRef<LassoSelectionScreenLayout | null>(null)
  const strokeIdsRef = useRef(selectedStrokeIds)
  const itemIdsRef = useRef(selectedItemIds)
  strokeIdsRef.current = selectedStrokeIds
  itemIdsRef.current = selectedItemIds

  useLayoutEffect(() => {
    if (!enabled) {
      lastLayoutRef.current = null
      setLayout(null)
      return
    }

    let frame = 0

    function update() {
      const canvasEl = canvasRef.current
      if (!canvasEl) {
        frame = requestAnimationFrame(update)
        return
      }

      const strokeIdSet = new Set(strokeIdsRef.current)
      const itemIdSet = new Set(itemIdsRef.current)
      const strokes = useStrokesStore
        .getState()
        .strokes.filter((stroke) => strokeIdSet.has(stroke.id))
      const items = useCanvasItemsStore
        .getState()
        .items.filter((item) => itemIdSet.has(item.id))
      const dragOffset = useLassoStore.getState().dragOffset

      const next = lassoSelectionScreenBounds(strokes, items, canvasEl, dragOffset)
      if (next) {
        const prev = lastLayoutRef.current
        if (!prev || !layoutsEqual(prev, next)) {
          lastLayoutRef.current = next
          setLayout(next)
        }
      }

      frame = requestAnimationFrame(update)
    }

    frame = requestAnimationFrame(update)
    window.addEventListener('resize', update)
    const vv = window.visualViewport
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', update)
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
    }
  }, [canvasRef, enabled, selectedStrokeIds.join(','), selectedItemIds.join(',')])

  return layout
}

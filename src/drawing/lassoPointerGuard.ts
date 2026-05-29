import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { shouldKeepLassoSelectionAtPointer } from './lassoGeometry'
import { useLassoStore } from './useLassoStore'
import { useStrokesStore } from './strokesStore'

/** True when an active lasso selection should stay up for this pointer target/point. */
export function keepActiveLassoSelectionForPointer(
  clientX: number,
  clientY: number,
  target: EventTarget | null,
  canvasEl: HTMLElement | null,
): boolean {
  const { selectedStrokeIds, selectedItemIds, dragOffset } = useLassoStore.getState()
  if (selectedStrokeIds.length === 0 && selectedItemIds.length === 0) return false

  const strokeIdSet = new Set(selectedStrokeIds)
  const itemIdSet = new Set(selectedItemIds)
  const strokes = useStrokesStore
    .getState()
    .strokes.filter((stroke) => strokeIdSet.has(stroke.id))
  const items = useCanvasItemsStore
    .getState()
    .items.filter((item) => itemIdSet.has(item.id))

  return shouldKeepLassoSelectionAtPointer(
    clientX,
    clientY,
    target,
    canvasEl,
    strokes,
    items,
    selectedStrokeIds,
    selectedItemIds,
    dragOffset,
  )
}

export function resolveLassoCanvasEl(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  const canvas = target.closest('.cutline-draw-target')
  return canvas instanceof HTMLElement ? canvas : null
}

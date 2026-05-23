import type { CanvasLayer } from '../canvasLock/layer'
import type { CanvasItem } from './types'

/** Global committed pen/highlighter strokes render at this stacking level. */
export const Z_STROKES = 1000

/** Canvas items below strokes use z-index in [Z_ITEMS_BELOW_MIN, Z_STROKES). */
export const Z_ITEMS_BELOW_MIN = 1

/** Canvas items above strokes use z-index in [Z_ITEMS_ABOVE_MIN, Z_ANNOTATION_MIN). */
export const Z_ITEMS_ABOVE_MIN = 1001

/** Temporary canvas ink (drawn while locked) — above committed items, below annotation items. */
export const Z_ANNOTATION_STROKES = 1500

/** In-progress canvas ink — above all committed content while the stroke is being drawn. */
export const Z_ACTIVE_STROKE = 4000

/** Temporary canvas items (added while locked) — always above committed + annotation strokes. */
export const Z_ANNOTATION_MIN = 2000

/** Blurs the canvas behind selected items (pointer-events: none). */
export const Z_SELECTION_DIM = 2900

/** Selected items render above the blur overlay. */
export const Z_SELECTION_ABOVE_DIM = 3000

export function isAboveStrokes(zIndex: number): boolean {
  return zIndex >= Z_ITEMS_ABOVE_MIN && zIndex < Z_ANNOTATION_MIN
}

export function isBelowStrokes(zIndex: number): boolean {
  return zIndex < Z_STROKES
}

export function isAnnotationItem(item: { layer?: CanvasLayer }): boolean {
  return item.layer === 'annotation'
}

export function isAnnotationZIndex(zIndex: number): boolean {
  return zIndex >= Z_ANNOTATION_MIN
}

function committedItems(items: CanvasItem[]): CanvasItem[] {
  return items.filter((i) => !isAnnotationItem(i))
}

function annotationItems(items: CanvasItem[]): CanvasItem[] {
  return items.filter(isAnnotationItem)
}

export function nextZIndexBelow(items: { zIndex: number; layer?: CanvasLayer }[]): number {
  const below = committedItems(items as CanvasItem[]).filter((i) =>
    isBelowStrokes(i.zIndex),
  )
  if (below.length === 0) return Z_ITEMS_BELOW_MIN
  return Math.max(...below.map((i) => i.zIndex)) + 1
}

/** New committed items spawn on the top committed layer (above pen strokes, below annotations). */
export function nextZIndexAbove(items: { zIndex: number; layer?: CanvasLayer }[]): number {
  const above = committedItems(items as CanvasItem[]).filter((i) =>
    isAboveStrokes(i.zIndex),
  )
  if (above.length === 0) return Z_ITEMS_ABOVE_MIN
  return Math.max(...above.map((i) => i.zIndex)) + 1
}

export function nextZIndexForLayer(
  items: CanvasItem[],
  layer: CanvasLayer,
): number {
  if (layer === 'annotation') return nextZIndexAnnotation(items)
  return nextZIndexAbove(items)
}

export function nextZIndexAnnotation(items: CanvasItem[]): number {
  const ann = annotationItems(items)
  if (ann.length === 0) return Z_ANNOTATION_MIN
  return Math.max(...ann.map((i) => i.zIndex)) + 1
}

export function zIndexForBringToFront(
  items: { id: string; zIndex: number; layer?: CanvasLayer }[],
  id: string,
): number {
  const item = items.find((i) => i.id === id)
  if (item && isAnnotationItem(item)) {
    return zIndexForBringToFrontAnnotation(items as CanvasItem[], id)
  }
  const above = committedItems(items as CanvasItem[]).filter(
    (i) => isAboveStrokes(i.zIndex) && i.id !== id,
  )
  const maxAbove =
    above.length > 0 ? Math.max(...above.map((i) => i.zIndex)) : Z_ITEMS_ABOVE_MIN - 1
  return maxAbove + 1
}

export function zIndexForBringToFrontAnnotation(
  items: CanvasItem[],
  id: string,
): number {
  const ann = annotationItems(items).filter((i) => i.id !== id)
  const maxAnn =
    ann.length > 0 ? Math.max(...ann.map((i) => i.zIndex)) : Z_ANNOTATION_MIN - 1
  return maxAnn + 1
}

export function zIndexForSendToBack(
  items: { id: string; zIndex: number; layer?: CanvasLayer }[],
  id: string,
): number {
  const item = items.find((i) => i.id === id)
  if (item && isAnnotationItem(item)) {
    return zIndexForSendToBackAnnotation(items as CanvasItem[], id)
  }
  const below = committedItems(items as CanvasItem[]).filter(
    (i) => isBelowStrokes(i.zIndex) && i.id !== id,
  )
  const minBelow = below.length > 0 ? Math.min(...below.map((i) => i.zIndex)) : Z_STROKES
  return Math.max(Z_ITEMS_BELOW_MIN, minBelow - 1)
}

export function zIndexForSendToBackAnnotation(
  items: CanvasItem[],
  id: string,
): number {
  const ann = annotationItems(items).filter((i) => i.id !== id)
  const minAnn =
    ann.length > 0 ? Math.min(...ann.map((i) => i.zIndex)) : Z_ANNOTATION_MIN + 1
  return Math.max(Z_ANNOTATION_MIN, minAnn - 1)
}

/** Raise within the item's stacking band — used while dragging. */
export function zIndexForRaiseInPlane(
  items: { id: string; zIndex: number; layer?: CanvasLayer }[],
  id: string,
): number {
  const item = items.find((i) => i.id === id)
  if (!item) return Z_ITEMS_BELOW_MIN
  if (isAnnotationItem(item)) {
    return zIndexForRaiseInAnnotationPlane(items as CanvasItem[], id)
  }

  if (isAboveStrokes(item.zIndex)) {
    const above = committedItems(items as CanvasItem[]).filter((i) =>
      isAboveStrokes(i.zIndex),
    )
    const maxAbove = Math.max(...above.map((i) => i.zIndex))
    return maxAbove + 1
  }

  const below = committedItems(items as CanvasItem[]).filter((i) =>
    isBelowStrokes(i.zIndex),
  )
  const maxBelow = Math.max(...below.map((i) => i.zIndex))
  return Math.min(maxBelow + 1, Z_STROKES - 1)
}

export function zIndexForRaiseInAnnotationPlane(
  items: CanvasItem[],
  _id: string,
): number {
  const ann = annotationItems(items)
  if (ann.length === 0) return Z_ANNOTATION_MIN
  return Math.max(...ann.map((i) => i.zIndex)) + 1
}

/** Bump legacy annotation items into the annotation z band after load. */
export function normalizeAnnotationItemZIndices(items: CanvasItem[]): {
  items: CanvasItem[]
  changed: boolean
} {
  let changed = false
  const next = items.map((item) => {
    if (!isAnnotationItem(item)) return item
    if (item.zIndex >= Z_ANNOTATION_MIN) return item
    changed = true
    return { ...item, zIndex: Z_ANNOTATION_MIN + item.zIndex }
  })
  return { items: next, changed }
}

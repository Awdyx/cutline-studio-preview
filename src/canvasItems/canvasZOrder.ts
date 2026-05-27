import type { CanvasLayer } from '../canvasLock/layer'
import type { CanvasItem } from './types'

/** Global committed pen/highlighter strokes render at this stacking level. */
export const Z_STROKES = 1000

/** Canvas items below strokes use z-index in [Z_ITEMS_BELOW_MIN, Z_STROKES). */
export const Z_ITEMS_BELOW_MIN = 1

/** Canvas items above strokes use z-index >= Z_ITEMS_ABOVE_MIN (unbounded upward). */
export const Z_ITEMS_ABOVE_MIN = 1001

/** Temporary canvas ink (drawn while locked) — above committed items, below annotation items. */
export const Z_ANNOTATION_STROKES = 1500

/** In-progress canvas ink — above all committed content while the stroke is being drawn. */
export const Z_ACTIVE_STROKE = 4000

/** Temporary canvas items (added while locked) — always above committed + annotation strokes. */
export const Z_ANNOTATION_MIN = 2000

/** Blurs the canvas behind selected items (pointer-events: none). */
export const Z_SELECTION_DIM = 2900


/**
 * Force-lifted items (e.g. a space widget being hovered as a drop target during
 * a drag) sit just above the dim — visible/unblurred — but stay below the
 * selected/dragged items so they don't cover the thing the user is moving.
 */
export const Z_SELECTION_LIFT_HOVER = 2901

/** Selected items render above the blur overlay (and above force-lifted items). */
export const Z_SELECTION_ABOVE_DIM = 3000

/** Blocks canvas pointer events during study-hub menu focus (above all canvas layers). */
export const Z_MENU_FOCUS_BLOCKER = 5000

export function committedItemZRank(items: CanvasItem[], id: string): number {
  const sorted = [...committedItems(items)].sort(
    (a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id),
  )
  const rank = sorted.findIndex((entry) => entry.id === id)
  return rank >= 0 ? rank : 0
}

/**
 * Lift selected items (and any explicit force-lift item, e.g. a space being
 * hovered as a drop target) above the dim overlay while keeping their relative
 * z-order. Unselected, non-lifted items keep their natural z-index so the dim
 * overlay can blur them.
 *
 * Force-lifted items sit on a lower tier than selected/dragged items, so a
 * hovered space stays beneath the item being dragged across it — including
 * handle-drags where the item was never selected.
 */
export function displayZIndexForCanvasItem(
  items: CanvasItem[],
  item: CanvasItem,
  selectedIds: readonly string[],
  options?: { forceLift?: boolean; isActiveDrag?: boolean },
): number {
  if (selectedIds.includes(item.id) || options?.isActiveDrag === true) {
    // Use rank * 2 (even slots) so lasso-lifted strokes can occupy the odd
    // slots in between and maintain their natural z-ordering relative to items.
    return Z_SELECTION_ABOVE_DIM + committedItemZRank(items, item.id) * 2
  }
  if (options?.forceLift === true) return Z_SELECTION_LIFT_HOVER
  return item.zIndex
}

export function isAboveStrokes(zIndex: number): boolean {
  return zIndex >= Z_ITEMS_ABOVE_MIN
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

export function committedStrokeZIndex(stroke: { zIndex?: number }): number {
  return stroke.zIndex ?? Z_STROKES
}

/** Committed strokes at or above this render after the above-items plane. */
export function isStrokeAboveItems(zIndex: number): boolean {
  return zIndex >= Z_ITEMS_ABOVE_MIN
}

export function maxCommittedStrokeZ(strokes: { zIndex?: number }[]): number {
  if (strokes.length === 0) return Z_STROKES
  return Math.max(...strokes.map(committedStrokeZIndex))
}

/** Next z-index for newly added canvas content — last added wins over items and strokes. */
export function nextCanvasStackZIndex(
  items: { zIndex: number; layer?: CanvasLayer }[],
  strokesLayerZ: number,
): number {
  let max = strokesLayerZ
  for (const item of items) {
    if (isAnnotationItem(item)) continue
    if (item.zIndex > max) max = item.zIndex
  }
  return max + 1
}

export function nextZIndexForLayer(
  items: CanvasItem[],
  layer: CanvasLayer,
  strokesLayerZ: number = Z_STROKES,
): number {
  if (layer === 'annotation') return nextZIndexAnnotation(items)
  return nextCanvasStackZIndex(items, strokesLayerZ)
}

export function nextZIndexAnnotation(items: CanvasItem[]): number {
  const ann = annotationItems(items)
  if (ann.length === 0) return Z_ANNOTATION_MIN
  return Math.max(...ann.map((i) => i.zIndex)) + 1
}

export function zIndexForBringToFront(
  items: { id: string; zIndex: number; layer?: CanvasLayer }[],
  id: string,
  strokes: { zIndex?: number }[] = [],
): number {
  const item = items.find((i) => i.id === id)
  if (item && isAnnotationItem(item)) {
    return zIndexForBringToFrontAnnotation(items as CanvasItem[], id)
  }

  const committed = committedItems(items as CanvasItem[])
  const others = committed.filter((i) => i.id !== id)
  // Strokes share the canvas committed plane, so an item brought to front
  // must clear them too — otherwise drawings drawn after the item stay on top.
  const strokeZs = strokes.map(committedStrokeZIndex)
  if (others.length === 0 && strokeZs.length === 0) {
    return item?.zIndex ?? Z_ITEMS_ABOVE_MIN
  }

  const maxOther = Math.max(...others.map((i) => i.zIndex), ...strokeZs)
  if (item && item.zIndex > maxOther) return item.zIndex

  return Math.max(maxOther + 1, Z_ITEMS_ABOVE_MIN)
}

export function zIndexForBringToFrontAnnotation(
  items: CanvasItem[],
  id: string,
): number {
  const item = items.find((i) => i.id === id)
  const ann = annotationItems(items).filter((i) => i.id !== id)
  if (ann.length === 0) return item?.zIndex ?? Z_ANNOTATION_MIN

  const maxOther = Math.max(...ann.map((i) => i.zIndex))
  if (item && item.zIndex > maxOther) return item.zIndex

  return maxOther + 1
}

export function zIndexForSendToBack(
  items: { id: string; zIndex: number; layer?: CanvasLayer }[],
  id: string,
  strokes: { zIndex?: number }[] = [],
): number {
  const item = items.find((i) => i.id === id)
  if (item && isAnnotationItem(item)) {
    return zIndexForSendToBackAnnotation(items as CanvasItem[], id)
  }

  const committed = committedItems(items as CanvasItem[])
  const others = committed.filter((i) => i.id !== id)
  // Strokes share the canvas committed plane, so an item sent to back must
  // dive below them too — otherwise drawings stay above the "back" item.
  const strokeZs = strokes.map(committedStrokeZIndex)
  if (others.length === 0 && strokeZs.length === 0) {
    return item?.zIndex ?? Z_ITEMS_BELOW_MIN
  }

  const minOther = Math.min(...others.map((i) => i.zIndex), ...strokeZs)
  if (item && item.zIndex < minOther) return item.zIndex

  let next = minOther - 1
  if (next >= Z_ITEMS_ABOVE_MIN) return next
  // Skip the reserved stroke layer z-index (1000) — it is not a valid item band.
  if (next >= Z_STROKES) next = Z_STROKES - 1
  return Math.max(Z_ITEMS_BELOW_MIN, next)
}

export function zIndexForSendToBackAnnotation(
  items: CanvasItem[],
  id: string,
): number {
  const item = items.find((i) => i.id === id)
  const ann = annotationItems(items).filter((i) => i.id !== id)
  if (ann.length === 0) return item?.zIndex ?? Z_ANNOTATION_MIN

  const minOther = Math.min(...ann.map((i) => i.zIndex))
  if (item && item.zIndex < minOther) return item.zIndex

  return Math.max(Z_ANNOTATION_MIN, minOther - 1)
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

/**
 * Compute the display z-index for a lasso-lifted stroke in a mixed lasso
 * selection (strokes + items both selected).
 *
 * Items are lifted to Z_SELECTION_ABOVE_DIM + rank * 2 (even slots: 3000, 3002, …).
 * A stroke that naturally sits between two items occupies the odd slot between
 * their even slots, preserving the original z-ordering exactly.
 *
 * Formula: Z_SELECTION_ABOVE_DIM + itemsBelow * 2 - 1
 *   e.g. 0 items below → 2999 (below all lifted items, above blur at 2900)
 *        1 item below  → 3001 (between rank-0 item at 3000 and rank-1 at 3002)
 *        2 items below → 3003 (between rank-1 and rank-2) … and so on.
 */
export function lassoLiftedStrokeZIndex(items: CanvasItem[], strokeOrigZ: number): number {
  const itemsBelow = committedItems(items).filter((i) => i.zIndex < strokeOrigZ).length
  return Z_SELECTION_ABOVE_DIM + itemsBelow * 2 - 1
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

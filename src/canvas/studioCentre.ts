import { TriangleAlert } from 'lucide-react'
import {
  CANVAS_ORIGINAL_HEIGHT,
  CANVAS_ORIGINAL_WIDTH,
} from '../drawing/canvasDimensions'
import type { Stroke } from '../drawing/types'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { useStrokesStore } from '../drawing/strokesStore'
import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'
import type { CanvasItem } from '../canvasItems/types'
import { isImageInSticky, isStickyItem } from '../canvasItems/types'
import { imageCanvasPosition } from '../canvasItems/stickyImagePlacement'

const TOAST_COOLDOWN_MS = 2500
let lastBoundsToastAt = 0

export function isRectWithinStudioCentre(
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false
  if (!Number.isFinite(width) || !Number.isFinite(height)) return false
  if (width <= 0 || height <= 0) return false
  return (
    x >= 0 &&
    y >= 0 &&
    x + width <= CANVAS_ORIGINAL_WIDTH &&
    y + height <= CANVAS_ORIGINAL_HEIGHT
  )
}

export function isItemWithinStudioCentre(
  item: Pick<CanvasItem, 'x' | 'y' | 'width' | 'height'> & Partial<CanvasItem>,
  allItems?: readonly CanvasItem[],
): boolean {
  if (
    item.type === 'image' &&
    isImageInSticky(item as CanvasItem) &&
    allItems
  ) {
    const embedded = item as CanvasItem
    const sticky = allItems.find(
      (entry): entry is Extract<CanvasItem, { type: 'sticky' }> =>
        entry.id === (embedded as { stickyId?: string }).stickyId &&
        isStickyItem(entry),
    )
    if (sticky) {
      const pos = imageCanvasPosition(
        embedded as Pick<CanvasItem, 'x' | 'y'>,
        sticky,
      )
      return isRectWithinStudioCentre(pos.x, pos.y, item.width, item.height)
    }
  }
  return isRectWithinStudioCentre(item.x, item.y, item.width, item.height)
}

export function strokePointOutsideStudioCentre(x: number, y: number): boolean {
  return (
    x < 0 ||
    y < 0 ||
    x > CANVAS_ORIGINAL_WIDTH ||
    y > CANVAS_ORIGINAL_HEIGHT
  )
}

export function strokeExtendsOutsideStudioCentre(stroke: Stroke): boolean {
  for (const point of stroke.points) {
    if (strokePointOutsideStudioCentre(point.x, point.y)) return true
  }
  return false
}

export function isStrokeWithinStudioCentre(stroke: Stroke): boolean {
  if (stroke.points.length < 3) return false
  for (const point of stroke.points) {
    if (strokePointOutsideStudioCentre(point.x, point.y)) {
      return false
    }
  }
  return true
}

/** True when the stroke's first point lies inside the studio-centre box. */
export function isStrokeStartWithinStudioCentre(stroke: Stroke): boolean {
  const start = stroke.points[0]
  if (!start) return false
  return !strokePointOutsideStudioCentre(start.x, start.y)
}

/** Persist strokes that began inside the centre — tail may extend into the void. */
export function isStrokePersistableInStudioCentre(stroke: Stroke): boolean {
  if (stroke.points.length < 3) return false
  return isStrokeStartWithinStudioCentre(stroke)
}

export function filterItemsForStudioCentrePersist(items: CanvasItem[]): CanvasItem[] {
  return items.filter((item) => isItemWithinStudioCentre(item, items))
}

export function filterStrokesForStudioCentrePersist(strokes: Stroke[]): Stroke[] {
  return strokes.filter(isStrokePersistableInStudioCentre)
}

export function isStrokeWithinStudioCentreAtOffset(
  stroke: Stroke,
  dx: number,
  dy: number,
): boolean {
  if (stroke.points.length < 3) return false
  for (const point of stroke.points) {
    const x = point.x + dx
    const y = point.y + dy
    if (strokePointOutsideStudioCentre(x, y)) {
      return false
    }
  }
  return true
}

export function lassoMoveKeepsStudioCentre(
  strokeIds: readonly string[],
  itemIds: readonly string[],
  dx: number,
  dy: number,
): boolean {
  const items = useCanvasItemsStore.getState().items
  const selectedSet = new Set(itemIds)
  for (const id of itemIds) {
    const item = items.find((entry) => entry.id === id)
    if (!item) continue
    if (
      isImageInSticky(item) &&
      item.stickyId &&
      selectedSet.has(item.stickyId)
    ) {
      continue
    }
    if (
      !isItemWithinStudioCentre(
        { ...item, x: item.x + dx, y: item.y + dy },
        items,
      )
    ) {
      return false
    }
  }

  const strokes = useStrokesStore.getState().strokes
  for (const id of strokeIds) {
    const stroke = strokes.find((entry) => entry.id === id)
    if (!stroke) continue
    if (!isStrokeWithinStudioCentreAtOffset(stroke, dx, dy)) return false
  }

  return true
}

export function showStudioCentreBoundsToast(): void {
  const now = Date.now()
  if (now - lastBoundsToastAt < TOAST_COOLDOWN_MS) return
  lastBoundsToastAt = now

  requestAnimationFrame(() => {
    const store = useShortcutUiStore.getState()
    store.showActionToast({
      shortcutId: 'studio-centre-bounds',
      label: 'elements can only be placed within your studio',
      keys: [],
      icon: TriangleAlert,
      holdMs: 3200,
    })
    store.shakeActionToast()
  })
}

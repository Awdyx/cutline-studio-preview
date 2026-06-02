import { TriangleAlert } from 'lucide-react'
import {
  CANVAS_ORIGINAL_HEIGHT,
  CANVAS_ORIGINAL_WIDTH,
  STUDIO_STROKE_BLEED_PAD,
} from '../drawing/canvasDimensions'
import type { Stroke } from '../drawing/types'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { useStrokesStore } from '../drawing/strokesStore'
import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'
import type { CanvasItem } from '../canvasItems/types'
import { isImageInSticky, isStickyItem } from '../canvasItems/types'
import { imageCanvasPosition } from '../canvasItems/stickyImagePlacement'
import { useCanvasWorkspaceStore } from './canvasWorkspaceStore'
import {
  clampPocketStripItemX,
  clampPocketStripItemY,
  pocketStripBounds,
  POCKET_STRIP_STROKE_BLEED_PAD,
  POCKET_STRIP_VIRTUAL_HEIGHT,
} from './pocketStripDimensions'
import { readPocketStripState, usePocketStripStore } from './pocketStripStore'

export type ActiveCanvasLayout = {
  width: number
  height: number
  /** Pocket strip only — logical y of drawable band top. */
  minY: number
  strokeBleedPad: number
  isPocketStrip: boolean
}

const TOAST_COOLDOWN_MS = 2500
let lastBoundsToastAt = 0

export function isPocketStripActive(): boolean {
  return useCanvasWorkspaceStore.getState().isInsideSpace()
}

export function readActiveCanvasLayout(): ActiveCanvasLayout {
  if (!isPocketStripActive()) {
    return {
      width: CANVAS_ORIGINAL_WIDTH,
      height: CANVAS_ORIGINAL_HEIGHT,
      minY: 0,
      strokeBleedPad: STUDIO_STROKE_BLEED_PAD,
      isPocketStrip: false,
    }
  }

  const { logicalWidth } = readPocketStripState()
  const bounds = pocketStripBounds(logicalWidth)
  return {
    width: bounds.width,
    height: bounds.maxY - bounds.minY,
    minY: bounds.minY,
    strokeBleedPad: POCKET_STRIP_STROKE_BLEED_PAD,
    isPocketStrip: true,
  }
}

export function readActiveCanvasLogicalWidth(): number {
  if (!isPocketStripActive()) return CANVAS_ORIGINAL_WIDTH
  return usePocketStripStore.getState().logicalWidth
}

export function readActiveCanvasLogicalHeight(): number {
  if (!isPocketStripActive()) return CANVAS_ORIGINAL_HEIGHT
  return POCKET_STRIP_VIRTUAL_HEIGHT
}

export function isRectWithinActiveCanvas(
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false
  if (!Number.isFinite(width) || !Number.isFinite(height)) return false
  if (width <= 0 || height <= 0) return false

  const layout = readActiveCanvasLayout()
  const canvasTop = layout.minY
  const canvasRight = layout.width
  const canvasBottom = layout.minY + layout.height
  const itemRight = x + width
  const itemBottom = y + height

  // Overlap or edge-touch — items may extend past the border while still on canvas.
  return (
    x <= canvasRight &&
    itemRight >= 0 &&
    y <= canvasBottom &&
    itemBottom >= canvasTop
  )
}

export function rectExtendsPastActiveCanvas(
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false
  if (!Number.isFinite(width) || !Number.isFinite(height)) return false
  if (width <= 0 || height <= 0) return false

  const layout = readActiveCanvasLayout()
  const canvasTop = layout.minY
  const canvasRight = layout.width
  const canvasBottom = layout.minY + layout.height
  return (
    x < 0 ||
    y < canvasTop ||
    x + width > canvasRight ||
    y + height > canvasBottom
  )
}

export function itemExtendsPastActiveCanvas(
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
      return rectExtendsPastActiveCanvas(pos.x, pos.y, item.width, item.height)
    }
  }
  return rectExtendsPastActiveCanvas(item.x, item.y, item.width, item.height)
}

export function isItemWithinActiveCanvas(
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
      return isRectWithinActiveCanvas(pos.x, pos.y, item.width, item.height)
    }
  }
  return isRectWithinActiveCanvas(item.x, item.y, item.width, item.height)
}

export function strokePointOutsideActiveCanvas(x: number, y: number): boolean {
  if (isPocketStripActive()) {
    const logicalWidth = readActiveCanvasLogicalWidth()
    const bounds = pocketStripBounds(logicalWidth)
    return (
      x < 0 ||
      x > logicalWidth ||
      y < bounds.minY ||
      y > bounds.maxY
    )
  }
  return (
    x < 0 ||
    y < 0 ||
    x > CANVAS_ORIGINAL_WIDTH ||
    y > CANVAS_ORIGINAL_HEIGHT
  )
}

export function strokeExtendsOutsideActiveCanvas(stroke: Stroke): boolean {
  for (const point of stroke.points) {
    if (strokePointOutsideActiveCanvas(point.x, point.y)) return true
  }
  return false
}

export function isStrokeStartWithinActiveCanvas(stroke: Stroke): boolean {
  const start = stroke.points[0]
  if (!start) return false
  return !strokePointOutsideActiveCanvas(start.x, start.y)
}

export function isStrokeWithinActiveCanvasAtOffset(
  stroke: Stroke,
  dx: number,
  dy: number,
): boolean {
  if (stroke.points.length < 3) return false
  for (const point of stroke.points) {
    if (strokePointOutsideActiveCanvas(point.x + dx, point.y + dy)) {
      return false
    }
  }
  return true
}

export function lassoMoveKeepsActiveCanvas(
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
      !isItemWithinActiveCanvas(
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
    if (!isStrokeWithinActiveCanvasAtOffset(stroke, dx, dy)) return false
  }

  return true
}

export function showActiveCanvasBoundsToast(): void {
  const now = Date.now()
  if (now - lastBoundsToastAt < TOAST_COOLDOWN_MS) return
  lastBoundsToastAt = now

  const label = isPocketStripActive()
    ? 'elements can only be placed within your pocket'
    : 'elements can only be placed within your studio'

  requestAnimationFrame(() => {
    const store = useShortcutUiStore.getState()
    store.showActionToast({
      shortcutId: 'studio-centre-bounds',
      label,
      keys: [],
      icon: TriangleAlert,
      holdMs: 3200,
    })
    store.shakeActionToast()
  })
}

export function clampItemPositionInPocketStrip(
  x: number,
  y: number,
  itemWidth: number,
  itemHeight: number,
  logicalWidth: number,
): { x: number; y: number } {
  return {
    x: clampPocketStripItemX(x, itemWidth, logicalWidth),
    y: clampPocketStripItemY(y, itemHeight),
  }
}

export function clampItemPositionInActiveCanvas(
  x: number,
  y: number,
  itemWidth: number,
  itemHeight: number,
): { x: number; y: number } {
  if (!isPocketStripActive()) {
    return {
      x: Math.max(0, Math.min(CANVAS_ORIGINAL_WIDTH - itemWidth, x)),
      y: Math.max(0, Math.min(CANVAS_ORIGINAL_HEIGHT - itemHeight, y)),
    }
  }

  const logicalWidth = readActiveCanvasLogicalWidth()
  const bounds = pocketStripBounds(logicalWidth)
  return {
    x: Math.max(0, Math.min(logicalWidth - itemWidth, x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY - itemHeight, y)),
  }
}

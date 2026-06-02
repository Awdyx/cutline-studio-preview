import { clientToCanvasFromElementForItem } from '../drawing/canvasCoords'
import { effectiveCanvasLocked } from '../canvasLock/layer'
import { useCanvasLockStore } from '../canvasLock/canvasLockStore'
import { isAnnotationItem } from './canvasZOrder'
import { useCanvasItemsStore } from './canvasItemsStore'
import { hitTestStickyAtCanvasPoint } from './stickyHitTest'
import type { CanvasItem, ImageCanvasItem, StickyCanvasItem } from './types'
import { isImageInSticky } from './types'

export { isImageInSticky }

export function imageCanvasPosition(
  item: Pick<ImageCanvasItem, 'x' | 'y'>,
  sticky: Pick<StickyCanvasItem, 'x' | 'y'>,
): { x: number; y: number } {
  return { x: sticky.x + item.x, y: sticky.y + item.y }
}

/** Canvas item top-left → sticky-local coordinates (may be negative for partial overlap). */
export function imageLocalPositionInSticky(
  item: Pick<ImageCanvasItem, 'x' | 'y'>,
  sticky: Pick<StickyCanvasItem, 'x' | 'y'>,
): { x: number; y: number } {
  return {
    x: item.x - sticky.x,
    y: item.y - sticky.y,
  }
}

export type StickyLocalRect = { x: number; y: number; width: number; height: number }

/** Sticky-local rectangles where an embedded image extends outside the clip bounds. */
export function embeddedImageOverflowRects(
  image: Pick<ImageCanvasItem, 'x' | 'y' | 'width' | 'height'>,
  sticky: Pick<StickyCanvasItem, 'width' | 'height'>,
): StickyLocalRect[] {
  const { x: ix, y: iy, width: iw, height: ih } = image
  const sw = sticky.width
  const sh = sticky.height
  const ib = ix + iw
  const ir = iy + ih
  const rects: StickyLocalRect[] = []

  if (iy < 0) {
    rects.push({ x: ix, y: iy, width: iw, height: Math.min(-iy, ih) })
  }
  if (ir > sh) {
    rects.push({ x: ix, y: sh, width: iw, height: ir - sh })
  }

  const sideTop = Math.max(iy, 0)
  const sideBottom = Math.min(ir, sh)
  const sideHeight = sideBottom - sideTop
  if (sideHeight > 0) {
    if (ix < 0) {
      rects.push({
        x: ix,
        y: sideTop,
        width: Math.min(-ix, iw),
        height: sideHeight,
      })
    }
    if (ib > sw) {
      rects.push({ x: sw, y: sideTop, width: ib - sw, height: sideHeight })
    }
  }

  return rects.filter((rect) => rect.width > 0 && rect.height > 0)
}

/** Overlap previews slightly under the sticky clip so seams stay hidden while dragging. */
export const STICKY_OVERFLOW_INSET_BLEED_PX = 2

/** Matches sticky face clip radius — used for overflow preview corner continuity. */
export const STICKY_CLIP_RADIUS = 4

export function canDropImageInSticky(item: CanvasItem | undefined): boolean {
  if (!item || item.type !== 'image') return false
  if (isImageInSticky(item)) return false
  return true
}

export type StickyDropHit = {
  stickyId: string
  canvasX: number
  canvasY: number
}

export function hitTestStickyForImageDrop(
  clientX: number,
  clientY: number,
  draggedItemId: string,
  canvasEl: HTMLElement | null,
): StickyDropHit | null {
  const dragged = useCanvasItemsStore
    .getState()
    .items.find((entry) => entry.id === draggedItemId)
  if (!canDropImageInSticky(dragged) || !canvasEl) return null

  const canvasPos = clientToCanvasFromElementForItem(clientX, clientY, canvasEl)
  if (!canvasPos) return null

  const stickyId = hitTestStickyAtCanvasPoint(canvasPos.x, canvasPos.y)
  if (!stickyId || stickyId === draggedItemId) return null

  const sticky = useCanvasItemsStore.getState().getStickyById(stickyId)
  if (!sticky) return null

  const isLocked = effectiveCanvasLocked(useCanvasLockStore.getState().isLocked)
  if (isLocked && !isAnnotationItem(sticky)) return null

  return { stickyId, canvasX: canvasPos.x, canvasY: canvasPos.y }
}

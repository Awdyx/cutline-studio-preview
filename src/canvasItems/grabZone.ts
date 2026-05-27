import { isPhoneLayout } from '../platform/layoutProfile'

/** Visual size of handle glyphs. */
export const HANDLE_VISUAL_SIZE = 20

/** Invisible tap/drag target (phone / coarse pointer). */
export const HANDLE_HIT_SIZE = 120

/** Reduced hit size for handles on small text items (phone). */
export const HANDLE_HIT_SIZE_SMALL = 60

/** Desktop invisible targets — 40% smaller than HANDLE_HIT_SIZE. */
const HANDLE_HIT_SIZE_DESKTOP = 72
const HANDLE_HIT_SIZE_SMALL_DESKTOP = 36

/** Text box is "small" when both dimensions are under these values. */
export const SMALL_TEXT_HANDLE_W = 300
export const SMALL_TEXT_HANDLE_H = 200

/** Grab handle: left of the item, vertically aligned with the item's top edge. */
export const GRAB_HANDLE_GAP = 4
export const GRAB_HANDLE_OFFSET_X = HANDLE_VISUAL_SIZE + GRAB_HANDLE_GAP
export const GRAB_HANDLE_TOP = 0

export type GrabHandleSide = 'left' | 'right'
export type GrabHandleVertical = 'top' | 'bottom'

export interface GrabHandlePlacement {
  side: GrabHandleSide
  vertical: GrabHandleVertical
}

export function resolveCanvasHandleHitSize(opts?: { small?: boolean }): number {
  const small = opts?.small ?? false
  if (isPhoneLayout()) {
    return small ? HANDLE_HIT_SIZE_SMALL : HANDLE_HIT_SIZE
  }
  return small ? HANDLE_HIT_SIZE_SMALL_DESKTOP : HANDLE_HIT_SIZE_DESKTOP
}

function hitOutsetForSize(hitSize: number): number {
  return (hitSize - HANDLE_VISUAL_SIZE) / 2
}

export function grabHandleHitOutset(hitSize = resolveCanvasHandleHitSize()): number {
  return hitOutsetForSize(hitSize)
}

/** Canvas-space left edge of the grab handle when placed on the given side. */
export function grabHandleCanvasLeft(
  itemX: number,
  itemWidth: number,
  side: GrabHandleSide,
  hitSize = resolveCanvasHandleHitSize(),
): number {
  const hitOutset = hitOutsetForSize(hitSize)
  if (side === 'left') {
    return itemX - GRAB_HANDLE_OFFSET_X - hitOutset
  }
  return itemX + itemWidth + GRAB_HANDLE_GAP - hitOutset
}

export function grabHandleFitsOnCanvas(
  itemX: number,
  itemWidth: number,
  side: GrabHandleSide,
  canvasWidth: number,
  hitSize = resolveCanvasHandleHitSize(),
): boolean {
  const left = grabHandleCanvasLeft(itemX, itemWidth, side, hitSize)
  return left >= 0 && left + hitSize <= canvasWidth
}

export function getGrabHandleSide(
  itemX: number,
  itemWidth: number,
  canvasWidth: number,
  hitSize = resolveCanvasHandleHitSize(),
): GrabHandleSide {
  if (grabHandleFitsOnCanvas(itemX, itemWidth, 'left', canvasWidth, hitSize)) {
    return 'left'
  }
  if (grabHandleFitsOnCanvas(itemX, itemWidth, 'right', canvasWidth, hitSize)) {
    return 'right'
  }

  const left = grabHandleCanvasLeft(itemX, itemWidth, 'left', hitSize)
  const right = grabHandleCanvasLeft(itemX, itemWidth, 'right', hitSize)
  const leftVisible =
    Math.min(left + hitSize, canvasWidth) - Math.max(left, 0)
  const rightVisible =
    Math.min(right + hitSize, canvasWidth) - Math.max(right, 0)
  return rightVisible > leftVisible ? 'right' : 'left'
}

/** Canvas-space top edge of the grab handle when placed on the given vertical side. */
export function grabHandleCanvasTop(
  itemY: number,
  itemHeight: number,
  vertical: GrabHandleVertical,
  hitSize = resolveCanvasHandleHitSize(),
): number {
  const hitOutset = hitOutsetForSize(hitSize)
  if (vertical === 'top') {
    return itemY + GRAB_HANDLE_TOP - hitOutset
  }
  return itemY + itemHeight - hitSize
}

export function grabHandleFitsVerticallyOnCanvas(
  itemY: number,
  itemHeight: number,
  vertical: GrabHandleVertical,
  canvasHeight: number,
  hitSize = resolveCanvasHandleHitSize(),
): boolean {
  const top = grabHandleCanvasTop(itemY, itemHeight, vertical, hitSize)
  return top >= 0 && top + hitSize <= canvasHeight
}

export function getGrabHandleVertical(
  itemY: number,
  itemHeight: number,
  canvasHeight: number,
  hitSize = resolveCanvasHandleHitSize(),
): GrabHandleVertical {
  if (grabHandleFitsVerticallyOnCanvas(itemY, itemHeight, 'top', canvasHeight, hitSize)) {
    return 'top'
  }
  if (grabHandleFitsVerticallyOnCanvas(itemY, itemHeight, 'bottom', canvasHeight, hitSize)) {
    return 'bottom'
  }

  const topEdge = grabHandleCanvasTop(itemY, itemHeight, 'top', hitSize)
  const bottomEdge = grabHandleCanvasTop(itemY, itemHeight, 'bottom', hitSize)
  const topVisible =
    Math.min(topEdge + hitSize, canvasHeight) - Math.max(topEdge, 0)
  const bottomVisible =
    Math.min(bottomEdge + hitSize, canvasHeight) - Math.max(bottomEdge, 0)
  return bottomVisible > topVisible ? 'bottom' : 'top'
}

export function getGrabHandlePlacement(
  itemX: number,
  itemY: number,
  itemWidth: number,
  itemHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  hitSize = resolveCanvasHandleHitSize(),
): GrabHandlePlacement {
  return {
    side: getGrabHandleSide(itemX, itemWidth, canvasWidth, hitSize),
    vertical: getGrabHandleVertical(itemY, itemHeight, canvasHeight, hitSize),
  }
}

export function grabHandleHorizontalStyle(
  side: GrabHandleSide,
  hitSize = resolveCanvasHandleHitSize(),
): { left: number | string } {
  const hitOutset = hitOutsetForSize(hitSize)
  if (side === 'left') {
    return { left: -(GRAB_HANDLE_OFFSET_X + hitOutset) }
  }
  return { left: `calc(100% + ${GRAB_HANDLE_GAP - hitOutset}px)` }
}

export function grabHandleVerticalStyle(
  vertical: GrabHandleVertical,
  hitSize = resolveCanvasHandleHitSize(),
): { top?: number | string; bottom?: number | string } {
  const hitOutset = hitOutsetForSize(hitSize)
  if (vertical === 'top') {
    return { top: GRAB_HANDLE_TOP - hitOutset, bottom: 'auto' }
  }
  return { bottom: 0, top: 'auto' }
}

export function grabHandlePlacementKey(placement: GrabHandlePlacement): string {
  return `${placement.side}-${placement.vertical}`
}

/** Gap outside bottom-right corner. */
export const RESIZE_CORNER_OUTSET = 0

/** Extra offset for space cards (stacked shadow sits flush on the corner). */
export const SPACE_RESIZE_CORNER_OUTSET = 6

/** Gap between a selected item edge and its arrangement menu. */
export const Z_MENU_GAP = 10

/** Matches CanvasItemZOrderMenu minWidth — used to center spawn clusters. */
export const Z_MENU_MIN_WIDTH = 168
export const Z_MENU_MIN_WIDTH_PHONE = 132

export const MIN_ITEM_WIDTH = 48
export const MIN_ITEM_HEIGHT = 48

/** Visual size of handle glyphs. */
export const HANDLE_VISUAL_SIZE = 20

/** Slightly larger tap/drag target than the visible icon. */
export const HANDLE_HIT_SIZE = 72

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

export function grabHandleHitOutset(): number {
  return (HANDLE_HIT_SIZE - HANDLE_VISUAL_SIZE) / 2
}

/** Canvas-space left edge of the grab handle when placed on the given side. */
export function grabHandleCanvasLeft(
  itemX: number,
  itemWidth: number,
  side: GrabHandleSide,
): number {
  const hitOutset = grabHandleHitOutset()
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
): boolean {
  const left = grabHandleCanvasLeft(itemX, itemWidth, side)
  return left >= 0 && left + HANDLE_HIT_SIZE <= canvasWidth
}

export function getGrabHandleSide(
  itemX: number,
  itemWidth: number,
  canvasWidth: number,
): GrabHandleSide {
  if (grabHandleFitsOnCanvas(itemX, itemWidth, 'left', canvasWidth)) {
    return 'left'
  }
  if (grabHandleFitsOnCanvas(itemX, itemWidth, 'right', canvasWidth)) {
    return 'right'
  }

  const left = grabHandleCanvasLeft(itemX, itemWidth, 'left')
  const right = grabHandleCanvasLeft(itemX, itemWidth, 'right')
  const leftVisible =
    Math.min(left + HANDLE_HIT_SIZE, canvasWidth) - Math.max(left, 0)
  const rightVisible =
    Math.min(right + HANDLE_HIT_SIZE, canvasWidth) - Math.max(right, 0)
  return rightVisible > leftVisible ? 'right' : 'left'
}

/** Canvas-space top edge of the grab handle when placed on the given vertical side. */
export function grabHandleCanvasTop(
  itemY: number,
  itemHeight: number,
  vertical: GrabHandleVertical,
): number {
  const hitOutset = grabHandleHitOutset()
  if (vertical === 'top') {
    return itemY + GRAB_HANDLE_TOP - hitOutset
  }
  return itemY + itemHeight - HANDLE_HIT_SIZE
}

export function grabHandleFitsVerticallyOnCanvas(
  itemY: number,
  itemHeight: number,
  vertical: GrabHandleVertical,
  canvasHeight: number,
): boolean {
  const top = grabHandleCanvasTop(itemY, itemHeight, vertical)
  return top >= 0 && top + HANDLE_HIT_SIZE <= canvasHeight
}

export function getGrabHandleVertical(
  itemY: number,
  itemHeight: number,
  canvasHeight: number,
): GrabHandleVertical {
  if (grabHandleFitsVerticallyOnCanvas(itemY, itemHeight, 'top', canvasHeight)) {
    return 'top'
  }
  if (grabHandleFitsVerticallyOnCanvas(itemY, itemHeight, 'bottom', canvasHeight)) {
    return 'bottom'
  }

  const topEdge = grabHandleCanvasTop(itemY, itemHeight, 'top')
  const bottomEdge = grabHandleCanvasTop(itemY, itemHeight, 'bottom')
  const topVisible =
    Math.min(topEdge + HANDLE_HIT_SIZE, canvasHeight) - Math.max(topEdge, 0)
  const bottomVisible =
    Math.min(bottomEdge + HANDLE_HIT_SIZE, canvasHeight) - Math.max(bottomEdge, 0)
  return bottomVisible > topVisible ? 'bottom' : 'top'
}

export function getGrabHandlePlacement(
  itemX: number,
  itemY: number,
  itemWidth: number,
  itemHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): GrabHandlePlacement {
  return {
    side: getGrabHandleSide(itemX, itemWidth, canvasWidth),
    vertical: getGrabHandleVertical(itemY, itemHeight, canvasHeight),
  }
}

export function grabHandleHorizontalStyle(
  side: GrabHandleSide,
): { left: number | string } {
  const hitOutset = grabHandleHitOutset()
  if (side === 'left') {
    return { left: -(GRAB_HANDLE_OFFSET_X + hitOutset) }
  }
  return { left: `calc(100% + ${GRAB_HANDLE_GAP - hitOutset}px)` }
}

export function grabHandleVerticalStyle(
  vertical: GrabHandleVertical,
): { top?: number | string; bottom?: number | string } {
  const hitOutset = grabHandleHitOutset()
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

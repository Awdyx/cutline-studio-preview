import { readLayoutViewport } from '../platform/viewportSize'

/** True when any screen pixel of the item shell intersects the layout viewport. */
export function isCanvasItemVisibleInViewport(itemId: string): boolean {
  const el = document.querySelector(`[data-item-id="${itemId}"]`)
  if (!(el instanceof HTMLElement)) return false

  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false

  const viewport = readLayoutViewport()
  const viewportRight = viewport.left + viewport.width
  const viewportBottom = viewport.top + viewport.height

  return (
    rect.right > viewport.left &&
    rect.left < viewportRight &&
    rect.bottom > viewport.top &&
    rect.top < viewportBottom
  )
}

export function isPointInClientRect(
  x: number,
  y: number,
  rect: DOMRect | DOMRectReadOnly,
): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

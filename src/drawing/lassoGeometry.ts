import {
  CANVAS_ORIGINAL_HEIGHT,
  CANVAS_ORIGINAL_WIDTH,
  studioLogicalToVisual,
  studioVisualToLogical,
} from './canvasDimensions'
import { clientToCanvasFromElement } from './canvasCoords'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import type { Stroke } from './types'
import type { CanvasItemBase } from '../canvasItems/types'

export type ScreenRect = { left: number; top: number; right: number; bottom: number }
export type CanvasRect = { left: number; top: number; right: number; bottom: number }

const LASSO_CHROME_PAD_SCREEN = 18
export const LASSO_CHROME_PAD = 18

export type Pt = { x: number; y: number }

/** Studio-centre working area as a canvas-space rectangle polygon. */
export function studioCentrePolygon(): Pt[] {
  return [
    { x: 0, y: 0 },
    { x: CANVAS_ORIGINAL_WIDTH, y: 0 },
    { x: CANVAS_ORIGINAL_WIDTH, y: CANVAS_ORIGINAL_HEIGHT },
    { x: 0, y: CANVAS_ORIGINAL_HEIGHT },
  ]
}

/** Ray-casting point-in-polygon test. */
export function pointInPolygon(px: number, py: number, poly: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y
    const xj = poly[j].x, yj = poly[j].y
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Stroke intersects polygon if ANY sampled stroke point falls inside.
 * `poly` is in canvas coordinates; stroke points are canvas coordinates.
 */
export function strokeIntersectsPolygon(stroke: Stroke, poly: Pt[]): boolean {
  if (poly.length < 3) return false
  // Sample every 3rd point for performance
  for (let i = 0; i < stroke.points.length; i += 3) {
    if (pointInPolygon(stroke.points[i].x, stroke.points[i].y, poly)) return true
  }
  // Also check last point
  if (stroke.points.length > 0) {
    const last = stroke.points[stroke.points.length - 1]
    if (pointInPolygon(last.x, last.y, poly)) return true
  }
  return false
}

/**
 * Canvas item intersects if ANY corner of its bounding box is inside the polygon.
 * `poly` is in canvas coordinates; item x/y/width/height are canvas coordinates.
 */
export function itemIntersectsPolygon(item: CanvasItemBase, poly: Pt[]): boolean {
  if (poly.length < 3) return false
  const corners: Pt[] = [
    { x: item.x, y: item.y },
    { x: item.x + item.width, y: item.y },
    { x: item.x + item.width, y: item.y + item.height },
    { x: item.x, y: item.y + item.height },
    { x: item.x + item.width / 2, y: item.y + item.height / 2 }, // center
  ]
  return corners.some((c) => pointInPolygon(c.x, c.y, poly))
}

function studioContentScaleActive(): boolean {
  return !useCanvasWorkspaceStore.getState().isInsideSpace()
}

function visualDrawTargetCoord(logical: number): number {
  return studioContentScaleActive() ? studioLogicalToVisual(logical) : logical
}

/** Convert screen-space lasso points → logical canvas coordinates. */
export function screenPolyToCanvas(
  screenPoly: Pt[],
  canvasEl: HTMLElement,
): Pt[] {
  const rect = canvasEl.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return []
  const scaleX = canvasEl.offsetWidth / rect.width
  const scaleY = canvasEl.offsetHeight / rect.height
  return screenPoly.map((p) => {
    const visualX = (p.x - rect.left) * scaleX
    const visualY = (p.y - rect.top) * scaleY
    return {
      x: studioContentScaleActive() ? studioVisualToLogical(visualX) : visualX,
      y: studioContentScaleActive() ? studioVisualToLogical(visualY) : visualY,
    }
  })
}

/** Canvas-space bounds for the current lasso selection (optional drag preview offset). */
export function lassoSelectionCanvasBounds(
  strokes: Stroke[],
  items: CanvasItemBase[],
  dragOffset: { canvasDx: number; canvasDy: number } | null = null,
): CanvasRect | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const stroke of strokes) {
    for (const pt of stroke.points) {
      if (pt.x < minX) minX = pt.x
      if (pt.y < minY) minY = pt.y
      if (pt.x > maxX) maxX = pt.x
      if (pt.y > maxY) maxY = pt.y
    }
  }

  for (const item of items) {
    if (item.x < minX) minX = item.x
    if (item.y < minY) minY = item.y
    if (item.x + item.width > maxX) maxX = item.x + item.width
    if (item.y + item.height > maxY) maxY = item.y + item.height
  }

  if (!isFinite(minX)) return null

  const dx = dragOffset?.canvasDx ?? 0
  const dy = dragOffset?.canvasDy ?? 0
  return {
    left: minX + dx,
    top: minY + dy,
    right: maxX + dx,
    bottom: maxY + dy,
  }
}

/** Padded canvas-space rect for the draggable selection chrome. */
export function lassoSelectionChromeCanvasRect(
  strokes: Stroke[],
  items: CanvasItemBase[],
  dragOffset: { canvasDx: number; canvasDy: number } | null = null,
): { left: number; top: number; width: number; height: number } | null {
  const bounds = lassoSelectionCanvasBounds(strokes, items, dragOffset)
  if (!bounds) return null
  return {
    left: bounds.left - LASSO_CHROME_PAD,
    top: bounds.top - LASSO_CHROME_PAD,
    width: bounds.right - bounds.left + LASSO_CHROME_PAD * 2,
    height: bounds.bottom - bounds.top + LASSO_CHROME_PAD * 2,
  }
}

function screenPadForCanvas(canvasEl: HTMLElement): number {
  const rect = canvasEl.getBoundingClientRect()
  if (rect.width <= 0) return LASSO_CHROME_PAD_SCREEN
  return LASSO_CHROME_PAD_SCREEN * (canvasEl.offsetWidth / rect.width)
}

/** Screen-space chrome bounds (selection box + padding) for overlay positioning. */
export function lassoSelectionScreenBounds(
  strokes: Stroke[],
  items: CanvasItemBase[],
  canvasEl: HTMLElement,
  dragOffset: { canvasDx: number; canvasDy: number } | null = null,
): ScreenRect | null {
  const canvasBounds = lassoSelectionCanvasBounds(strokes, items, dragOffset)
  if (!canvasBounds) return null

  const rect = canvasEl.getBoundingClientRect()
  const scaleX = rect.width / canvasEl.offsetWidth
  const scaleY = rect.height / canvasEl.offsetHeight
  const pad = LASSO_CHROME_PAD_SCREEN

  return {
    left: rect.left + visualDrawTargetCoord(canvasBounds.left) * scaleX - pad,
    top: rect.top + visualDrawTargetCoord(canvasBounds.top) * scaleY - pad,
    right: rect.left + visualDrawTargetCoord(canvasBounds.right) * scaleX + pad,
    bottom: rect.top + visualDrawTargetCoord(canvasBounds.bottom) * scaleY + pad,
  }
}

/** True when a screen point is inside the lasso chrome (padded selection bounds). */
export function clientPointInLassoSelection(
  clientX: number,
  clientY: number,
  canvasEl: HTMLElement,
  strokes: Stroke[],
  items: CanvasItemBase[],
  dragOffset: { canvasDx: number; canvasDy: number } | null = null,
): boolean {
  const pos = clientToCanvasFromElement(clientX, clientY, canvasEl)
  if (!pos) return false
  const bounds = lassoSelectionCanvasBounds(strokes, items, dragOffset)
  if (!bounds) return false
  const pad = screenPadForCanvas(canvasEl)
  return (
    pos.x >= bounds.left - pad &&
    pos.x <= bounds.right + pad &&
    pos.y >= bounds.top - pad &&
    pos.y <= bounds.bottom + pad
  )
}

/** Keep an active lasso selection for taps/drags on its chrome or padded bounds. */
export function shouldKeepLassoSelectionAtPointer(
  clientX: number,
  clientY: number,
  target: EventTarget | null,
  canvasEl: HTMLElement | null,
  strokes: Stroke[],
  items: CanvasItemBase[],
  selectedStrokeIds: readonly string[],
  selectedItemIds: readonly string[],
  dragOffset: { canvasDx: number; canvasDy: number } | null = null,
): boolean {
  if (selectedStrokeIds.length === 0 && selectedItemIds.length === 0) return false
  if (!(target instanceof Element)) return false
  if (target.closest('[data-lasso-selection]')) return true

  const itemEl = target.closest('[data-item-id]')
  if (itemEl) {
    const itemId = itemEl.getAttribute('data-item-id')
    if (itemId && selectedItemIds.includes(itemId)) return true
  }

  if (!canvasEl) return false
  return clientPointInLassoSelection(
    clientX,
    clientY,
    canvasEl,
    strokes,
    items,
    dragOffset,
  )
}

/** Compute screen-space bounding box of a set of canvas-space stroke points. */
export function strokesScreenBounds(
  strokes: Stroke[],
  canvasEl: HTMLElement,
): ScreenRect | null {
  if (strokes.length === 0) return null
  const rect = canvasEl.getBoundingClientRect()
  const scaleX = rect.width / canvasEl.offsetWidth
  const scaleY = rect.height / canvasEl.offsetHeight

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const stroke of strokes) {
    for (const pt of stroke.points) {
      const sx = rect.left + visualDrawTargetCoord(pt.x) * scaleX
      const sy = rect.top + visualDrawTargetCoord(pt.y) * scaleY
      if (sx < minX) minX = sx
      if (sy < minY) minY = sy
      if (sx > maxX) maxX = sx
      if (sy > maxY) maxY = sy
    }
  }
  if (!isFinite(minX)) return null
  return { left: minX, top: minY, right: maxX, bottom: maxY }
}

/** Compute screen-space bounding box of canvas items (using canvas element for coord mapping). */
export function itemsScreenBounds(
  items: CanvasItemBase[],
  canvasEl: HTMLElement,
): ScreenRect | null {
  if (items.length === 0) return null
  const rect = canvasEl.getBoundingClientRect()
  const scaleX = rect.width / canvasEl.offsetWidth
  const scaleY = rect.height / canvasEl.offsetHeight

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const item of items) {
    const sx = rect.left + visualDrawTargetCoord(item.x) * scaleX
    const sy = rect.top + visualDrawTargetCoord(item.y) * scaleY
    const ex = rect.left + visualDrawTargetCoord(item.x + item.width) * scaleX
    const ey = rect.top + visualDrawTargetCoord(item.y + item.height) * scaleY
    if (sx < minX) minX = sx
    if (sy < minY) minY = sy
    if (ex > maxX) maxX = ex
    if (ey > maxY) maxY = ey
  }
  if (!isFinite(minX)) return null
  return { left: minX, top: minY, right: maxX, bottom: maxY }
}

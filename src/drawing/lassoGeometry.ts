import type { Stroke } from './types'
import type { CanvasItemBase } from '../canvasItems/types'

export type Pt = { x: number; y: number }

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

/** Convert screen-space lasso points → canvas coordinates using the canvas element. */
export function screenPolyToCanvas(
  screenPoly: Pt[],
  canvasEl: HTMLElement,
): Pt[] {
  const rect = canvasEl.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return []
  const scaleX = canvasEl.offsetWidth / rect.width
  const scaleY = canvasEl.offsetHeight / rect.height
  return screenPoly.map((p) => ({
    x: (p.x - rect.left) * scaleX,
    y: (p.y - rect.top) * scaleY,
  }))
}

/** Compute screen-space bounding box of a set of canvas-space stroke points. */
export function strokesScreenBounds(
  strokes: Stroke[],
  canvasEl: HTMLElement,
): { left: number; top: number; right: number; bottom: number } | null {
  if (strokes.length === 0) return null
  const rect = canvasEl.getBoundingClientRect()
  const scaleX = rect.width / canvasEl.offsetWidth
  const scaleY = rect.height / canvasEl.offsetHeight

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const stroke of strokes) {
    for (const pt of stroke.points) {
      const sx = rect.left + pt.x * scaleX
      const sy = rect.top + pt.y * scaleY
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
): { left: number; top: number; right: number; bottom: number } | null {
  if (items.length === 0) return null
  const rect = canvasEl.getBoundingClientRect()
  const scaleX = rect.width / canvasEl.offsetWidth
  const scaleY = rect.height / canvasEl.offsetHeight

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const item of items) {
    const sx = rect.left + item.x * scaleX
    const sy = rect.top + item.y * scaleY
    const ex = rect.left + (item.x + item.width) * scaleX
    const ey = rect.top + (item.y + item.height) * scaleY
    if (sx < minX) minX = sx
    if (sy < minY) minY = sy
    if (ex > maxX) maxX = ex
    if (ey > maxY) maxY = ey
  }
  if (!isFinite(minX)) return null
  return { left: minX, top: minY, right: maxX, bottom: maxY }
}

import type { CanvasItemBase } from '../canvasItems/types'
import type { Stroke } from './types'

/** Eraser tip radius in canvas units (center of the eraser cursor). */
export const ERASE_HIT_RADIUS = 12

/** Small pad so hits match anti-aliased ink at stroke edges. */
const STROKE_ERASE_EDGE_PAD = 2

function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - x1, py - y1)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

/** Hit radius that covers the full rendered stroke width plus the eraser tip. */
export function strokeEraseHitRadius(
  stroke: Stroke,
  tipRadius: number = ERASE_HIT_RADIUS,
): number {
  return tipRadius + stroke.size / 2 + STROKE_ERASE_EDGE_PAD
}

/** Expanded item bounds — eraser tip can graze the edge of a target. */
export function eraserHitsItem(
  item: CanvasItemBase,
  x: number,
  y: number,
  radius: number = ERASE_HIT_RADIUS,
): boolean {
  return (
    x >= item.x - radius &&
    x <= item.x + item.width + radius &&
    y >= item.y - radius &&
    y <= item.y + item.height + radius
  )
}

/** True when the eraser tip overlaps any part of the stroke's visible ink. */
export function hitTestStroke(
  stroke: Stroke,
  x: number,
  y: number,
  tipRadius: number = ERASE_HIT_RADIUS,
): boolean {
  const points = stroke.points
  const n = points.length
  if (n === 0) return false

  const hitRadius = strokeEraseHitRadius(stroke, tipRadius)

  if (n === 1) {
    const p = points[0]
    return Math.hypot(p.x - x, p.y - y) <= hitRadius
  }

  let minX = points[0].x
  let maxX = minX
  let minY = points[0].y
  let maxY = minY
  for (let i = 1; i < n; i++) {
    const p = points[i]
    if (p.x < minX) minX = p.x
    else if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    else if (p.y > maxY) maxY = p.y
  }
  if (
    x < minX - hitRadius ||
    x > maxX + hitRadius ||
    y < minY - hitRadius ||
    y > maxY + hitRadius
  ) {
    return false
  }

  for (let i = 0; i < n - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (distanceToSegment(x, y, a.x, a.y, b.x, b.y) <= hitRadius) return true
  }
  return false
}

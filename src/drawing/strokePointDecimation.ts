import type { StrokePoint } from './types'

/** Min gap between stored stroke samples — midway between every move and half density. */
export const STROKE_POINT_MIN_DISTANCE = 1

export function strokePointDistance(a: StrokePoint, b: StrokePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Skip capture samples that land too close to the previous point. */
export function shouldAppendStrokePoint(
  last: StrokePoint | undefined,
  next: StrokePoint,
  minDistance = STROKE_POINT_MIN_DISTANCE,
): boolean {
  if (!last) return true
  return strokePointDistance(last, next) >= minDistance
}

/** Drop dense runs; always keep endpoints. */
export function decimateStrokePoints(
  points: StrokePoint[],
  minDistance = STROKE_POINT_MIN_DISTANCE,
): StrokePoint[] {
  if (points.length <= 2) return points

  const out: StrokePoint[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const pt = points[i]
    const isLast = i === points.length - 1
    if (isLast || strokePointDistance(out[out.length - 1], pt) >= minDistance) {
      out.push(pt)
    }
  }
  return out
}

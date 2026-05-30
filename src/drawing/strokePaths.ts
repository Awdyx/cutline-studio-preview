import { strokeToSvgPath } from './strokePath'
import { decimateStrokePoints } from './strokePointDecimation'
import type { Stroke } from './types'

/** Ensure persisted strokes have decimated points + a cached SVG path. */
export function ensureStrokePath(stroke: Stroke): Stroke {
  const points = decimateStrokePoints(stroke.points)
  const decimated = points.length !== stroke.points.length
  const normalized = decimated ? { ...stroke, points, path: undefined } : stroke
  if (typeof normalized.path === 'string' && normalized.path.length > 0) {
    return normalized
  }
  const path = strokeToSvgPath(normalized, true)
  return path ? { ...normalized, path } : normalized
}

export function ensureStrokePaths(strokes: Stroke[]): Stroke[] {
  return strokes.map(ensureStrokePath)
}

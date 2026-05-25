import { strokeToSvgPath } from './strokePath'
import type { Stroke } from './types'

/** Ensure persisted strokes have a cached SVG path (never compute during render). */
export function ensureStrokePath(stroke: Stroke): Stroke {
  if (typeof stroke.path === 'string' && stroke.path.length > 0) {
    return stroke
  }
  const path = strokeToSvgPath(stroke, false)
  return path ? { ...stroke, path } : stroke
}

export function ensureStrokePaths(strokes: Stroke[]): Stroke[] {
  return strokes.map(ensureStrokePath)
}

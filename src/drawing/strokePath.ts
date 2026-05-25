import { getStroke } from 'perfect-freehand'
import { getFlatSvgPathFromStroke } from './pathUtils'
import type { Stroke, StrokePoint } from './types'

/** Tap / click dots — duplicate the last point so perfect-freehand can render. */
export function ensureMinimumStrokePoints(
  points: StrokePoint[],
  min: number,
): StrokePoint[] {
  const out = [...points]
  while (out.length > 0 && out.length < min) {
    out.push({ ...out[out.length - 1] })
  }
  return out
}

export function strokeToSvgPath(stroke: Stroke, isComplete: boolean): string {
  if (stroke.points.length === 0) return ''

  const points = stroke.points.map(
    (p) => [p.x, p.y, p.pressure] as [number, number, number],
  )

  const outline = getStroke(points, {
    size: stroke.size,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: false,
    last: isComplete,
    start: {
      cap: true,
      taper: 0,
    },
    end: {
      cap: true,
      taper: 0,
    },
  })

  if (outline.length === 0) {
    console.log('[DRAW] getStroke returned empty outline', {
      pointCount: stroke.points.length,
      last: isComplete,
    })
    return ''
  }

  return getFlatSvgPathFromStroke(outline)
}

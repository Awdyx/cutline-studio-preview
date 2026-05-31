import { CANVAS_MAX_SCALE } from '../drawing/canvasDimensions'

const SCALE_EPS = 0.002

export function isBeyondHardZoomMax(scale: number): boolean {
  return scale > CANVAS_MAX_SCALE + SCALE_EPS
}

export function isBeyondHardZoomMin(scale: number, minScale: number): boolean {
  return scale < minScale - SCALE_EPS
}

export function hardClampScale(scale: number, minScale: number): number {
  return Math.min(CANVAS_MAX_SCALE, Math.max(minScale, scale))
}

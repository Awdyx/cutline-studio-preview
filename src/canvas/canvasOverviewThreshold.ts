import {
  getCanvasHardMinScale,
  getCanvasOverviewScale,
} from '../drawing/canvasDimensions'

export function overviewEnterScale(
  viewportWidth: number,
  viewportHeight: number,
): number {
  return getCanvasOverviewScale(viewportWidth, viewportHeight)
}

/** Normal max zoom-out when leaving overview. */
export function overviewExitScale(
  viewportWidth: number,
  viewportHeight: number,
): number {
  return getCanvasHardMinScale(viewportWidth, viewportHeight)
}

export function isAtOverviewScale(
  scale: number,
  viewportWidth: number,
  viewportHeight: number,
): boolean {
  const target = overviewEnterScale(viewportWidth, viewportHeight)
  return scale <= target * 1.002
}

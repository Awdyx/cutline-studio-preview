/** Logical canvas size in px (4:3 landscape). */
export const CANVAS_WIDTH = 2000
export const CANVAS_HEIGHT = 1500
export const CANVAS_ASPECT = CANVAS_WIDTH / CANVAS_HEIGHT

/** Stay 20% more zoomed-in than the edge-to-edge cover fit (scale × 1.2). */
const MIN_SCALE_COVER_FACTOR = 1.2

export const CANVAS_MAX_SCALE = 4

/**
 * Minimum zoom scale: cover the viewport in both axes (no letterboxing), then
 * zoom in 20% further so the canvas always extends past every edge.
 */
export function getCanvasMinScale(
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight,
): number {
  const coverScale = Math.max(
    viewportWidth / CANVAS_WIDTH,
    viewportHeight / CANVAS_HEIGHT,
  )
  return coverScale * MIN_SCALE_COVER_FACTOR
}

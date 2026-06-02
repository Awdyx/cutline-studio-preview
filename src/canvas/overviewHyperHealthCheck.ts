import {
  CANVAS_ORIGINAL_HEIGHT,
  CANVAS_ORIGINAL_WIDTH,
  CANVAS_VIRTUAL_WIDTH,
} from '../drawing/canvasDimensions'

const PLATE_WIDTH_TOLERANCE = 8

/** Dev-only: steady overview must have hyper DOM + attrs applied. */
export function assertOverviewHyperHealth(): void {
  if (!import.meta.env.DEV) return

  const root = document.documentElement
  const style = getComputedStyle(root)
  const canvasWidth = parseFloat(style.getPropertyValue('--canvas-width'))
  const hasHyperAttr = root.hasAttribute('data-canvas-overview-hyper')
  const plateWidth = Number.isFinite(canvasWidth) ? canvasWidth : NaN
  const plateSized =
    Number.isFinite(plateWidth) &&
    Math.abs(plateWidth - CANVAS_ORIGINAL_WIDTH) <= PLATE_WIDTH_TOLERANCE

  if (hasHyperAttr && plateSized) return

  console.warn('[cutline overview] hyper layout mismatch while overview engaged', {
    'data-canvas-overview-hyper': hasHyperAttr,
    '--canvas-width': style.getPropertyValue('--canvas-width').trim(),
    expectedWidth: `${CANVAS_ORIGINAL_WIDTH}px`,
    fullVoidWidth: CANVAS_VIRTUAL_WIDTH,
  })
}

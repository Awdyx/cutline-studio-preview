import {
  CANVAS_CONTENT_OFFSET_X,
  CANVAS_CONTENT_OFFSET_Y,
  CANVAS_HEIGHT,
  CANVAS_ORIGINAL_HEIGHT,
  CANVAS_ORIGINAL_WIDTH,
  CANVAS_WIDTH,
} from '../drawing/canvasDimensions'
import type { CanvasPlateRect } from './studioCentreRect'

export type StudioCentrePosition = {
  x: number
  y: number
}

/** Studio top-left so the plate sits in the middle of the pannable void (7000×4000). */
export function centredStudioCentrePosition(): StudioCentrePosition {
  return {
    x: Math.round(CANVAS_CONTENT_OFFSET_X),
    y: Math.round(CANVAS_CONTENT_OFFSET_Y),
  }
}

export function defaultStudioCentrePosition(): StudioCentrePosition {
  return centredStudioCentrePosition()
}

/** Always place the studio in the void centre (ignore stale saved offsets). */
export function resolveStudioCentrePosition(
  _raw?: StudioCentrePosition | null,
): StudioCentrePosition {
  return centredStudioCentrePosition()
}

/** Expanded minimap width — keep in sync with `CANVAS_MINIMAP_EXPANDED_WIDTH_PX`. */
const MINIMAP_REFERENCE_WIDTH_PX = 600
/** Target breathing room from canvas edge to studio centre (~28px on expanded minimap). */
const MINIMAP_PLATE_EDGE_GAP_PX = 28
/** Extra top-only gap so minimap title row keeps a little more air. */
const MINIMAP_PLATE_TOP_EXTRA_GAP_PX = 15

function canvasInsetFromMinimapGapPx(gapPx: number): number {
  return Math.round((gapPx / MINIMAP_REFERENCE_WIDTH_PX) * CANVAS_WIDTH)
}

/** Minimum canvas-space inset from left, right, and bottom canvas edges. */
export const STUDIO_CENTRE_POSITION_BORDER_INSET = canvasInsetFromMinimapGapPx(
  MINIMAP_PLATE_EDGE_GAP_PX,
)

/** Minimum canvas-space inset from the top canvas edge only. */
export const STUDIO_CENTRE_POSITION_BORDER_INSET_TOP = canvasInsetFromMinimapGapPx(
  MINIMAP_PLATE_EDGE_GAP_PX + MINIMAP_PLATE_TOP_EXTRA_GAP_PX,
)

export function clampStudioCentrePosition(x: number, y: number): StudioCentrePosition {
  const maxX = CANVAS_WIDTH - CANVAS_ORIGINAL_WIDTH
  const maxY = CANVAS_HEIGHT - CANVAS_ORIGINAL_HEIGHT
  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
  }
}

export function studioCentreRectAt(x: number, y: number): CanvasPlateRect {
  return {
    x,
    y,
    width: CANVAS_ORIGINAL_WIDTH,
    height: CANVAS_ORIGINAL_HEIGHT,
  }
}

/** Draw-target position on the expanded canvas. */
export function syncStudioCentreLayoutVars(x: number, y: number): void {
  document.documentElement.style.setProperty('--canvas-studio-x', `${x}px`)
  document.documentElement.style.setProperty('--canvas-studio-y', `${y}px`)
}

/** Push studio-centre layout CSS vars. */
export function syncStudioCentreCssVars(x: number, y: number): void {
  syncStudioCentreLayoutVars(x, y)
}

export function normalizeStudioCentrePosition(
  raw: unknown,
): StudioCentrePosition | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as StudioCentrePosition
  if (typeof o.x !== 'number' || typeof o.y !== 'number') return null
  if (!Number.isFinite(o.x) || !Number.isFinite(o.y)) return null
  return resolveStudioCentrePosition(o)
}

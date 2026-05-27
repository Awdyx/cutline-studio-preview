import {
  CANVAS_HEIGHT,
  CANVAS_MAX_SCALE,
  CANVAS_WIDTH,
  getCanvasMinScale,
} from '../drawing/canvasDimensions'
import { STUDY_HUB_SPAWN_SIZE_FACTOR } from './studyHubSpawnScale'
import { STUDY_HUB_ASPECT, STUDY_HUB_WIDTH } from './types'

/** Typical desktop viewport for zoom-out limit estimates. */
const REFERENCE_VIEWPORT = { width: 1440, height: 900 }

/** Readable on-screen floor at max zoom-in (CANVAS_MAX_SCALE). */
const MIN_ON_SCREEN_WIDTH = 252 * 1.2

/** Scales all max-size caps down (0.84 = base 0.7 limit × 1.2). */
const MAX_SIZE_SCALE = 0.7 * 1.2

/** Do not exceed this share of the visible viewport when fully zoomed out. */
const MAX_VIEWPORT_WIDTH_RATIO = 0.74 * MAX_SIZE_SCALE
const MAX_VIEWPORT_HEIGHT_RATIO = 0.78 * MAX_SIZE_SCALE

/** Do not exceed this share of the logical canvas. */
const MAX_CANVAS_WIDTH_RATIO = 0.7 * MAX_SIZE_SCALE
const MAX_CANVAS_HEIGHT_RATIO = 0.74 * MAX_SIZE_SCALE

function referenceMinZoomScale(): number {
  return getCanvasMinScale(REFERENCE_VIEWPORT.width, REFERENCE_VIEWPORT.height)
}

/** Smallest canvas-space width (at max zoom-in). */
export function studyHubMinCanvasWidth(): number {
  return MIN_ON_SCREEN_WIDTH / CANVAS_MAX_SCALE
}

export function studyHubMinCanvasHeight(): number {
  return studyHubMinCanvasWidth() / STUDY_HUB_ASPECT
}

/** Largest canvas-space width allowed by viewport + canvas caps. */
export function studyHubMaxCanvasWidth(): number {
  const minZoom = referenceMinZoomScale()
  const fromViewport =
    (REFERENCE_VIEWPORT.width * MAX_VIEWPORT_WIDTH_RATIO) / minZoom
  const fromCanvas = CANVAS_WIDTH * MAX_CANVAS_WIDTH_RATIO
  const fromHeight = studyHubMaxCanvasHeight() * STUDY_HUB_ASPECT
  return Math.min(fromViewport, fromCanvas, fromHeight)
}

export function studyHubMaxCanvasHeight(): number {
  const minZoom = referenceMinZoomScale()
  const fromViewport =
    (REFERENCE_VIEWPORT.height * MAX_VIEWPORT_HEIGHT_RATIO) / minZoom
  const fromCanvas = CANVAS_HEIGHT * MAX_CANVAS_HEIGHT_RATIO
  return Math.min(fromViewport, fromCanvas)
}

export function clampStudyHubCanvasWidth(width: number): number {
  const minW = studyHubMinCanvasWidth()
  const maxW = studyHubMaxCanvasWidth()
  if (!Number.isFinite(width)) return STUDY_HUB_WIDTH
  return Math.min(maxW, Math.max(minW, width))
}

/** Width/height locked to design aspect ratio and canvas/zoom bounds. */
export function studyHubDimensionsForWidth(width: number): {
  width: number
  height: number
} {
  const clampedWidth = clampStudyHubCanvasWidth(width)
  return {
    width: clampedWidth,
    height: clampedWidth / STUDY_HUB_ASPECT,
  }
}

/** Default spawn size in canvas space, clamped to bounds. */
export function studyHubSpawnDimensions(spawnScale: number): {
  width: number
  height: number
} {
  const rawWidth = (STUDY_HUB_WIDTH / spawnScale) * STUDY_HUB_SPAWN_SIZE_FACTOR
  return studyHubDimensionsForWidth(rawWidth)
}

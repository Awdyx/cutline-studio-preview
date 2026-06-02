/** Virtual void size — pan bounds, minimap, and studio reposition (math only). */
export const CANVAS_VIRTUAL_WIDTH = 7000
export const CANVAS_VIRTUAL_HEIGHT = 4000

/** @deprecated Alias — prefer CANVAS_VIRTUAL_* for pan math. */
export const CANVAS_WIDTH = CANVAS_VIRTUAL_WIDTH
/** @deprecated Alias — prefer CANVAS_VIRTUAL_* for pan math. */
export const CANVAS_HEIGHT = CANVAS_VIRTUAL_HEIGHT

export function canvasVirtualWidth(): number {
  return CANVAS_VIRTUAL_WIDTH
}

export function canvasVirtualHeight(): number {
  return CANVAS_VIRTUAL_HEIGHT
}

/** DOM transform content on the main canvas — studio plate only (overview hyper mode). */
export function canvasDomWidth(): number {
  return CANVAS_ORIGINAL_WIDTH
}

export function canvasDomHeight(): number {
  return CANVAS_ORIGINAL_HEIGHT
}

/** Pan/zoom transform content size — full void normally, studio plate in overview hyper mode. */
export function canvasLayoutWidth(hyperOptimized = false): number {
  return hyperOptimized ? canvasDomWidth() : CANVAS_VIRTUAL_WIDTH
}

export function canvasLayoutHeight(hyperOptimized = false): number {
  return hyperOptimized ? canvasDomHeight() : CANVAS_VIRTUAL_HEIGHT
}

export const CANVAS_ASPECT = CANVAS_VIRTUAL_WIDTH / CANVAS_VIRTUAL_HEIGHT

/** Original 4:3 working area — logical coords for items, strokes, and pockets. */
export const CANVAS_ORIGINAL_WIDTH = 2026
export const CANVAS_ORIGINAL_HEIGHT = 1520

/** Default studio-centre top-left on the main canvas. */
export const CANVAS_CONTENT_OFFSET_X = (CANVAS_WIDTH - CANVAS_ORIGINAL_WIDTH) / 2
export const CANVAS_CONTENT_OFFSET_Y = (CANVAS_HEIGHT - CANVAS_ORIGINAL_HEIGHT) / 2

/** Soft ramp width between studio centre fill and outer margin. */
export const CANVAS_STUDIO_EDGE_FADE = Math.round(920 * 0.75)

/** Extra reach for plate focus detection — wider than edge fade, visuals unchanged. */
export const CANVAS_PLATE_VIEWPORT_ZONE_PAD = Math.round(1560 * 0.75)

/**
 * Open ambient music zone beyond the studio canvas bounds.
 * Negative values pull muffling in toward the studio edge; keep smaller than edge fade.
 */
export const CANVAS_STUDIO_ACOUSTICS_EDGE_PAD = Math.round(-240 * 0.75)

/** Rounded corners on plate working surfaces (visual clip only). */
export const STUDIO_CENTRE_CORNER_RADIUS = Math.round(40 * 0.75)

export const STUDIO_SURFACE_CORNER_RADIUS = STUDIO_CENTRE_CORNER_RADIUS

/** Extra SVG pad for session-only strokes drawn outside the studio-centre box. */
export const STUDIO_STROKE_BLEED_PAD = Math.round(6000 * 0.75)

/** Default / reset zoom — comfortable working distance on the studio centre. */
const CANVAS_WORK_COVER_FACTOR = 2.25

/** Pinch/wheel zoom-out floor — former overview scale (edge-to-edge studio cover). */
const CANVAS_HARD_MIN_COVER_FACTOR = 1.0

/** Canvas overview / map — zoomed out past the pinch floor. */
const CANVAS_OVERVIEW_COVER_FACTOR = 0.5

export const CANVAS_MAX_SCALE = 2

/** Soft overshoot past hard zoom limits (scale units); snaps back on release. */
export const CANVAS_ZOOM_EDGE_PADDING = 0.1
/** Soft overshoot past min zoom; snaps back on release. */
export const CANVAS_ZOOM_MIN_EDGE_PADDING = 0.08

function studioCoverScale(
  viewportWidth: number,
  viewportHeight: number,
): number {
  return Math.max(
    viewportWidth / CANVAS_ORIGINAL_WIDTH,
    viewportHeight / CANVAS_ORIGINAL_HEIGHT,
  )
}

/** Resting zoom when resetting or first landing on the main canvas. */
export function getCanvasMinScale(
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight,
): number {
  return studioCoverScale(viewportWidth, viewportHeight) * CANVAS_WORK_COVER_FACTOR
}

/** Furthest pinch/wheel zoom-out before overview. */
export function getCanvasHardMinScale(
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight,
): number {
  return studioCoverScale(viewportWidth, viewportHeight) * CANVAS_HARD_MIN_COVER_FACTOR
}

/** Overview mode scale — beyond the pinch zoom-out floor. */
export function getCanvasOverviewScale(
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight,
): number {
  return studioCoverScale(viewportWidth, viewportHeight) * CANVAS_OVERVIEW_COVER_FACTOR
}

/** Logical canvas size in px — studio centre stays centred at (½, ½). */
export const CANVAS_WIDTH = 7000
export const CANVAS_HEIGHT = 4000

/** Pan/zoom transform content size on the main canvas (matches logical canvas). */
export function canvasLayoutWidth(): number {
  return CANVAS_WIDTH
}

export function canvasLayoutHeight(): number {
  return CANVAS_HEIGHT
}
export const CANVAS_ASPECT = CANVAS_WIDTH / CANVAS_HEIGHT

/** Original 4:3 working area — logical coords for items, strokes, and pockets. */
export const CANVAS_ORIGINAL_WIDTH = 2026
export const CANVAS_ORIGINAL_HEIGHT = 1520

/** Pocket interior — same logical working area as the studio centre. */
export const SPACE_CANVAS_WIDTH = CANVAS_ORIGINAL_WIDTH
export const SPACE_CANVAS_HEIGHT = CANVAS_ORIGINAL_HEIGHT
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

/** Stay well zoomed-in vs edge-to-edge cover fit — limits how far pinch/wheel can zoom out. */
const MIN_SCALE_COVER_FACTOR = 2.25

export const CANVAS_MAX_SCALE = 2

/** Soft overshoot past hard zoom limits (scale units); snaps back on release. */
export const CANVAS_ZOOM_EDGE_PADDING = 0.1
/** No extra give when zooming out — hard stop at min zoom. */
export const CANVAS_ZOOM_MIN_EDGE_PADDING = 0

/** Pinch-out floor matches resting min — no zoom-out below default. */
const LEGACY_ZOOM_OUT_RANGE_FACTOR = 1

/**
 * Pinch-out slack below resting min (0 = no extra zoom-out past resting scale).
 */
export const CANVAS_MAX_ZOOM_OUT_RETENTION = 0

/** Minimum zoom scale: cover the viewport against the studio area, then zoom in further. */
export function getCanvasMinScale(
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight,
): number {
  const coverScale = Math.max(
    viewportWidth / CANVAS_ORIGINAL_WIDTH,
    viewportHeight / CANVAS_ORIGINAL_HEIGHT,
  )
  return coverScale * MIN_SCALE_COVER_FACTOR
}

/** Pinch zoom-out floor (viewport-aware). Overview uses `getCanvasOverviewScale`. */
export function getCanvasHardMinScale(
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight,
): number {
  const softMin = getCanvasMinScale(viewportWidth, viewportHeight)
  const legacyFloor = softMin / LEGACY_ZOOM_OUT_RANGE_FACTOR
  const slack = softMin - legacyFloor
  return legacyFloor + slack * CANVAS_MAX_ZOOM_OUT_RETENTION
}

/** Overview mode scale — wider than normal max zoom-out, but not full-canvas fit. */
const OVERVIEW_SCALE_COVER_FACTOR = 1.0

export function getCanvasOverviewScale(
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight,
): number {
  const studioCover = Math.max(
    viewportWidth / CANVAS_ORIGINAL_WIDTH,
    viewportHeight / CANVAS_ORIGINAL_HEIGHT,
  )
  return studioCover * OVERVIEW_SCALE_COVER_FACTOR
}

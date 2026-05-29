/** Logical canvas size in px — studio centre stays centred at (½, ½). */
export const CANVAS_WIDTH = 15000
export const CANVAS_HEIGHT = 15000

/**
 * Grey margin painted outside the logical canvas so zoom-out overshoot at pan
 * limits never exposes the void background behind the transform layer.
 */
export const CANVAS_EDGE_BLEED = 2800

export function canvasLayoutWidth(): number {
  return CANVAS_WIDTH + CANVAS_EDGE_BLEED * 2
}

export function canvasLayoutHeight(): number {
  return CANVAS_HEIGHT + CANVAS_EDGE_BLEED * 2
}
export const CANVAS_ASPECT = CANVAS_WIDTH / CANVAS_HEIGHT

/** Prior canvas size — migrates saved studio positions (equal border crop). */
export const PREV_CANVAS_WIDTH = 20200
export const PREV_CANVAS_HEIGHT = 20000

/** Original square canvas — migrates saved studio positions (equal border crop). */
export const LEGACY_CANVAS_WIDTH = 40000
export const LEGACY_CANVAS_HEIGHT = 40000

/** Original 4:3 working area — logical coords for items, strokes, and pockets. */
export const CANVAS_ORIGINAL_WIDTH = 3000
export const CANVAS_ORIGINAL_HEIGHT = 2250

/**
 * Main-canvas studio render scale — plate footprint and ink/items scale up together;
 * persisted coordinates stay in the logical 3000×2250 space.
 */
export const STUDIO_CONTENT_SCALE = 1.4

/** Studio plate footprint on the expanded canvas (visual, not logical). */
export const STUDIO_VISUAL_WIDTH = Math.round(CANVAS_ORIGINAL_WIDTH * STUDIO_CONTENT_SCALE)
export const STUDIO_VISUAL_HEIGHT = Math.round(CANVAS_ORIGINAL_HEIGHT * STUDIO_CONTENT_SCALE)

/** Feature plates (forum, rankings, etc.) — 16:10, same width as studio logical. */
export const FEATURE_PLATE_WIDTH = CANVAS_ORIGINAL_WIDTH
export const FEATURE_PLATE_HEIGHT = Math.round(FEATURE_PLATE_WIDTH * (10 / 16))
export const FEATURE_PLATE_ASPECT = FEATURE_PLATE_WIDTH / FEATURE_PLATE_HEIGHT

/** Pocket interior — same logical working area as the studio centre. */
export const SPACE_CANVAS_WIDTH = CANVAS_ORIGINAL_WIDTH
export const SPACE_CANVAS_HEIGHT = CANVAS_ORIGINAL_HEIGHT
export const CANVAS_CONTENT_OFFSET_X = (CANVAS_WIDTH - STUDIO_VISUAL_WIDTH) / 2
export const CANVAS_CONTENT_OFFSET_Y = (CANVAS_HEIGHT - STUDIO_VISUAL_HEIGHT) / 2

/** Map studio-local pointer coords from the scaled draw target into logical space. */
export function studioVisualToLogical(value: number): number {
  return value / STUDIO_CONTENT_SCALE
}

/** Map logical studio coords to draw-target visual space. */
export function studioLogicalToVisual(value: number): number {
  return value * STUDIO_CONTENT_SCALE
}

/** Soft ramp width between studio centre fill and outer margin. */
export const CANVAS_STUDIO_EDGE_FADE = 920

/**
 * Open ambient music zone beyond the studio canvas bounds.
 * Negative values pull muffling in toward the studio edge; keep smaller than edge fade.
 */
export const CANVAS_STUDIO_ACOUSTICS_EDGE_PAD = -240

/** Void grid mask — inner stop (% of canvas half-axis) through studio + edge fade. */
export const CANVAS_VOID_GRID_MASK_INNER_STOP =
  ((STUDIO_VISUAL_WIDTH / 2 + CANVAS_STUDIO_EDGE_FADE) / (CANVAS_WIDTH / 2)) * 100

/** Rounded corners on plate working surfaces (visual clip only). */
export const STUDIO_CENTRE_CORNER_RADIUS = 40

/** Studio surface radius — scales with content zoom so corners stay proportional. */
export const STUDIO_SURFACE_CORNER_RADIUS = Math.round(
  STUDIO_CENTRE_CORNER_RADIUS * STUDIO_CONTENT_SCALE,
)

/** Extra SVG pad for session-only strokes drawn outside the studio-centre box. */
export const STUDIO_STROKE_BLEED_PAD = 6000

/** Stay 20% more zoomed-in than the edge-to-edge cover fit (scale × 1.2). */
const MIN_SCALE_COVER_FACTOR = 1.2

export const CANVAS_MAX_SCALE = 2

/** Soft overshoot past hard zoom limits (scale units); snaps back on release. */
export const CANVAS_ZOOM_EDGE_PADDING = 0.1
/** Slightly less give when zooming out — lighter settle at min zoom. */
export const CANVAS_ZOOM_MIN_EDGE_PADDING = 0.0425

/** Extra zoom-out range beyond the cover-fit floor (1.5× farther out). */
export const CANVAS_ZOOM_OUT_RANGE_FACTOR = 1.5

/**
 * Minimum zoom scale: cover the viewport against the logical studio area, then
 * zoom in 20% further. Uses logical (not visual) dimensions so a scaled-up studio
 * plate still feels zoomed-in when working — visual footprint is STUDIO_VISUAL_*.
 */
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

/** Hard zoom-out floor — cover fit divided by CANVAS_ZOOM_OUT_RANGE_FACTOR. */
export function getCanvasHardMinScale(
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight,
): number {
  return getCanvasMinScale(viewportWidth, viewportHeight) / CANVAS_ZOOM_OUT_RANGE_FACTOR
}

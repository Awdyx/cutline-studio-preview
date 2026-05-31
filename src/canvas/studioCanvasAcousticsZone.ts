import {
  CANVAS_STUDIO_ACOUSTICS_EDGE_PAD,
  CANVAS_STUDIO_EDGE_FADE,
  CANVAS_ORIGINAL_HEIGHT,
  CANVAS_ORIGINAL_WIDTH,
} from '../drawing/canvasDimensions'
import { useStudioCentrePositionStore } from './studioCentrePositionStore'

/** Elliptical zone around the studio canvas — matches the void ramp (FAB chrome, etc.). */
export function studioCanvasViewportZoneEllipse(studioX: number, studioY: number) {
  return {
    cx: studioX + CANVAS_ORIGINAL_WIDTH / 2,
    cy: studioY + CANVAS_ORIGINAL_HEIGHT / 2,
    rx: CANVAS_ORIGINAL_WIDTH / 2 + CANVAS_STUDIO_EDGE_FADE,
    ry: CANVAS_ORIGINAL_HEIGHT / 2 + CANVAS_STUDIO_EDGE_FADE,
  }
}

/** Tighter zone for ambient music — muffling starts nearer the studio edge. */
export function studioCanvasAcousticsEllipse(studioX: number, studioY: number) {
  return {
    cx: studioX + CANVAS_ORIGINAL_WIDTH / 2,
    cy: studioY + CANVAS_ORIGINAL_HEIGHT / 2,
    rx: CANVAS_ORIGINAL_WIDTH / 2 + CANVAS_STUDIO_ACOUSTICS_EDGE_PAD,
    ry: CANVAS_ORIGINAL_HEIGHT / 2 + CANVAS_STUDIO_ACOUSTICS_EDGE_PAD,
  }
}

function isPointInStudioEllipse(
  x: number,
  y: number,
  ellipse: ReturnType<typeof studioCanvasViewportZoneEllipse>,
): boolean {
  const { cx, cy, rx, ry } = ellipse
  if (rx <= 0 || ry <= 0) return false

  const nx = (x - cx) / rx
  const ny = (y - cy) / ry
  return nx * nx + ny * ny <= 1
}

/** True when a canvas point lies inside the studio ramp zone (FAB chrome, etc.). */
export function isPointInStudioCanvasViewportZone(
  x: number,
  y: number,
  studioX?: number,
  studioY?: number,
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return true

  let sx = studioX
  let sy = studioY
  if (sx == null || sy == null) {
    const pos = useStudioCentrePositionStore.getState()
    sx = pos.x
    sy = pos.y
  }

  return isPointInStudioEllipse(x, y, studioCanvasViewportZoneEllipse(sx, sy))
}

/** True when a canvas point lies inside the tighter ambient-music zone. */
export function isPointInStudioCanvasAcousticsZone(
  x: number,
  y: number,
  studioX?: number,
  studioY?: number,
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return true

  let sx = studioX
  let sy = studioY
  if (sx == null || sy == null) {
    const pos = useStudioCentrePositionStore.getState()
    sx = pos.x
    sy = pos.y
  }

  return isPointInStudioEllipse(x, y, studioCanvasAcousticsEllipse(sx, sy))
}

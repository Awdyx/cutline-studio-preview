import type { AppDestination } from '../navigation/appDestinationStore'
import {
  CANVAS_ORIGINAL_HEIGHT,
  CANVAS_ORIGINAL_WIDTH,
  CANVAS_PLATE_VIEWPORT_ZONE_PAD,
  CANVAS_STUDIO_ACOUSTICS_EDGE_PAD,
} from '../drawing/canvasDimensions'
import type { CanvasMinimapRect } from './canvasMinimapGeometry'
import { useStudioCentrePositionStore } from './studioCentrePositionStore'

export function canvasPlateRectAt(x: number, y: number): CanvasMinimapRect {
  return {
    x,
    y,
    width: CANVAS_ORIGINAL_WIDTH,
    height: CANVAS_ORIGINAL_HEIGHT,
  }
}

function canvasPlateViewportZoneEllipseForSize(
  plateX: number,
  plateY: number,
  plateWidth: number,
  plateHeight: number,
) {
  return {
    cx: plateX + plateWidth / 2,
    cy: plateY + plateHeight / 2,
    rx: plateWidth / 2 + CANVAS_PLATE_VIEWPORT_ZONE_PAD,
    ry: plateHeight / 2 + CANVAS_PLATE_VIEWPORT_ZONE_PAD,
  }
}

function canvasPlateAcousticsEllipseForSize(
  plateX: number,
  plateY: number,
  plateWidth: number,
  plateHeight: number,
) {
  return {
    cx: plateX + plateWidth / 2,
    cy: plateY + plateHeight / 2,
    rx: plateWidth / 2 + CANVAS_STUDIO_ACOUSTICS_EDGE_PAD,
    ry: plateHeight / 2 + CANVAS_STUDIO_ACOUSTICS_EDGE_PAD,
  }
}

export function canvasPlateViewportZoneEllipse(plateX: number, plateY: number) {
  return canvasPlateViewportZoneEllipseForSize(
    plateX,
    plateY,
    CANVAS_ORIGINAL_WIDTH,
    CANVAS_ORIGINAL_HEIGHT,
  )
}

export function canvasPlateAcousticsEllipse(plateX: number, plateY: number) {
  return canvasPlateAcousticsEllipseForSize(
    plateX,
    plateY,
    CANVAS_ORIGINAL_WIDTH,
    CANVAS_ORIGINAL_HEIGHT,
  )
}

function isPointInEllipse(
  x: number,
  y: number,
  ellipse: ReturnType<typeof canvasPlateViewportZoneEllipseForSize>,
): boolean {
  const { cx, cy, rx, ry } = ellipse
  if (rx <= 0 || ry <= 0) return false
  const nx = (x - cx) / rx
  const ny = (y - cy) / ry
  return nx * nx + ny * ny <= 1
}

function isPointInStudioPlateViewportZone(
  x: number,
  y: number,
  plateX: number,
  plateY: number,
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return true
  return isPointInEllipse(
    x,
    y,
    canvasPlateViewportZoneEllipse(plateX, plateY),
  )
}

function isPointInStudioPlateAcousticsZone(
  x: number,
  y: number,
  plateX: number,
  plateY: number,
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return true
  return isPointInEllipse(x, y, canvasPlateAcousticsEllipse(plateX, plateY))
}

export function isPointInCanvasPlateViewportZone(
  x: number,
  y: number,
  plateX: number,
  plateY: number,
): boolean {
  return isPointInStudioPlateViewportZone(x, y, plateX, plateY)
}

export function isPointInCanvasPlateAcousticsZone(
  x: number,
  y: number,
  plateX: number,
  plateY: number,
): boolean {
  return isPointInStudioPlateAcousticsZone(x, y, plateX, plateY)
}

function studioPlateViewportZoneDepth(
  x: number,
  y: number,
  plateX: number,
  plateY: number,
): number {
  const { cx, cy, rx, ry } = canvasPlateViewportZoneEllipse(plateX, plateY)
  if (rx <= 0 || ry <= 0) return Infinity
  const nx = (x - cx) / rx
  const ny = (y - cy) / ry
  return nx * nx + ny * ny
}

/** Normalized ellipse distance — lower = deeper inside the zone. */
export function canvasPlateViewportZoneDepth(
  x: number,
  y: number,
  plateX: number,
  plateY: number,
): number {
  return studioPlateViewportZoneDepth(x, y, plateX, plateY)
}

export type CanvasPlateHit = {
  destination: AppDestination
  depth: number
}

/** Normalized ellipse distance above 1.0 — still snap to nearest plate when approaching. */
const CANVAS_PLATE_VIEWPORT_NEAR_DEPTH = 1.18

/** Nearest plate within the viewport focus zone (ellipse + near reach). */
export function resolveCanvasPlateAt(
  x: number,
  y: number,
): CanvasPlateHit | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null

  const studio = useStudioCentrePositionStore.getState()
  const studioDepth = studioPlateViewportZoneDepth(x, y, studio.x, studio.y)
  if (studioDepth <= CANVAS_PLATE_VIEWPORT_NEAR_DEPTH) {
    return { destination: 'studio', depth: studioDepth }
  }
  return null
}

export function isPointInAnyCanvasPlateAcousticsZone(
  x: number,
  y: number,
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return true

  const studio = useStudioCentrePositionStore.getState()
  return isPointInStudioPlateAcousticsZone(x, y, studio.x, studio.y)
}

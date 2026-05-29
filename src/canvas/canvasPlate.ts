import type { AppDestination } from '../navigation/appDestinationStore'
import {
  CANVAS_CONTENT_OFFSET_X,
  CANVAS_CONTENT_OFFSET_Y,
  CANVAS_ORIGINAL_HEIGHT,
  CANVAS_ORIGINAL_WIDTH,
  CANVAS_STUDIO_ACOUSTICS_EDGE_PAD,
  CANVAS_STUDIO_EDGE_FADE,
  FEATURE_PLATE_HEIGHT,
  FEATURE_PLATE_WIDTH,
  STUDIO_VISUAL_HEIGHT,
  STUDIO_VISUAL_WIDTH,
} from '../drawing/canvasDimensions'
import type { CanvasMinimapRect } from './canvasMinimapGeometry'
import {
  clampFeaturePlatePosition,
  type StudioCentrePosition,
} from './studioCentrePosition'
import { useStudioCentrePositionStore } from './studioCentrePositionStore'
import { useFeaturePlatePositionStore } from './featurePlatePositionStore'

export const FEATURE_PLATE_DESTINATIONS = [
  'leaderboard',
  'forum',
  'groups',
  'ucat',
] as const

export type FeaturePlateDestination = (typeof FEATURE_PLATE_DESTINATIONS)[number]

export function isFeaturePlateDestination(
  dest: AppDestination,
): dest is FeaturePlateDestination {
  return (FEATURE_PLATE_DESTINATIONS as readonly string[]).includes(dest)
}

export const FEATURE_PLATE_TITLES: Record<FeaturePlateDestination, string> = {
  leaderboard: 'rankings',
  forum: 'forum',
  groups: 'groups',
  ucat: 'ucat',
}

/** Fisheye title suffix — same role as studio’s `<3`, per destination. */
export const FEATURE_PLATE_TITLE_SUFFIX: Record<FeaturePlateDestination, string> = {
  leaderboard: '<<',
  forum: '; )',
  groups: '^_^',
  ucat: 'T_T',
}

const PLATE_GAP = 1200

export function defaultFeaturePlatePositions(): Record<
  FeaturePlateDestination,
  StudioCentrePosition
> {
  const sx = CANVAS_CONTENT_OFFSET_X
  const sy = CANVAS_CONTENT_OFFSET_Y
  return {
    leaderboard: clampFeaturePlatePosition(
      sx - FEATURE_PLATE_WIDTH - PLATE_GAP,
      sy,
    ),
    forum: clampFeaturePlatePosition(sx + STUDIO_VISUAL_WIDTH + PLATE_GAP, sy),
    groups: clampFeaturePlatePosition(
      sx,
      sy + STUDIO_VISUAL_HEIGHT + PLATE_GAP,
    ),
    ucat: clampFeaturePlatePosition(
      sx,
      sy - FEATURE_PLATE_HEIGHT - PLATE_GAP,
    ),
  }
}

export function featurePlateRectAt(x: number, y: number): CanvasMinimapRect {
  return {
    x,
    y,
    width: FEATURE_PLATE_WIDTH,
    height: FEATURE_PLATE_HEIGHT,
  }
}

/** @deprecated Use studioCentreRectAt or featurePlateRectAt */
export function canvasPlateRectAt(x: number, y: number): CanvasMinimapRect {
  return {
    x,
    y,
    width: CANVAS_ORIGINAL_WIDTH,
    height: CANVAS_ORIGINAL_HEIGHT,
  }
}

export function plateDimensionsForDestination(
  destination: AppDestination,
): { width: number; height: number } {
  if (destination === 'studio') {
    return { width: STUDIO_VISUAL_WIDTH, height: STUDIO_VISUAL_HEIGHT }
  }
  return { width: FEATURE_PLATE_WIDTH, height: FEATURE_PLATE_HEIGHT }
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
    rx: plateWidth / 2 + CANVAS_STUDIO_EDGE_FADE,
    ry: plateHeight / 2 + CANVAS_STUDIO_EDGE_FADE,
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
    STUDIO_VISUAL_WIDTH,
    STUDIO_VISUAL_HEIGHT,
  )
}

export function canvasPlateAcousticsEllipse(plateX: number, plateY: number) {
  return canvasPlateAcousticsEllipseForSize(
    plateX,
    plateY,
    STUDIO_VISUAL_WIDTH,
    STUDIO_VISUAL_HEIGHT,
  )
}

function featurePlateViewportZoneEllipse(plateX: number, plateY: number) {
  return canvasPlateViewportZoneEllipseForSize(
    plateX,
    plateY,
    FEATURE_PLATE_WIDTH,
    FEATURE_PLATE_HEIGHT,
  )
}

function featurePlateAcousticsEllipse(plateX: number, plateY: number) {
  return canvasPlateAcousticsEllipseForSize(
    plateX,
    plateY,
    FEATURE_PLATE_WIDTH,
    FEATURE_PLATE_HEIGHT,
  )
}

export function featurePlateCssVarName(
  dest: FeaturePlateDestination,
  axis: 'x' | 'y',
): string {
  return `--canvas-plate-${dest}-${axis}`
}

export function syncFeaturePlateLayoutVars(
  dest: FeaturePlateDestination,
  x: number,
  y: number,
): void {
  const root = document.documentElement
  root.style.setProperty(featurePlateCssVarName(dest, 'x'), `${x}px`)
  root.style.setProperty(featurePlateCssVarName(dest, 'y'), `${y}px`)
}

export function syncAllFeaturePlateLayoutVars(
  positions: Record<FeaturePlateDestination, StudioCentrePosition>,
): void {
  for (const dest of FEATURE_PLATE_DESTINATIONS) {
    const { x, y } = positions[dest]
    syncFeaturePlateLayoutVars(dest, x, y)
  }
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

function isPointInFeaturePlateViewportZone(
  x: number,
  y: number,
  plateX: number,
  plateY: number,
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return true
  return isPointInEllipse(x, y, featurePlateViewportZoneEllipse(plateX, plateY))
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

function isPointInFeaturePlateAcousticsZone(
  x: number,
  y: number,
  plateX: number,
  plateY: number,
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return true
  return isPointInEllipse(x, y, featurePlateAcousticsEllipse(plateX, plateY))
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

function featurePlateViewportZoneDepth(
  x: number,
  y: number,
  plateX: number,
  plateY: number,
): number {
  const { cx, cy, rx, ry } = featurePlateViewportZoneEllipse(plateX, plateY)
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

/** Deepest plate whose viewport ellipse contains the point. */
export function resolveCanvasPlateAt(
  x: number,
  y: number,
): CanvasPlateHit | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null

  const studio = useStudioCentrePositionStore.getState()
  const feature = useFeaturePlatePositionStore.getState().positions

  const candidates: CanvasPlateHit[] = []

  if (isPointInStudioPlateViewportZone(x, y, studio.x, studio.y)) {
    candidates.push({
      destination: 'studio',
      depth: studioPlateViewportZoneDepth(x, y, studio.x, studio.y),
    })
  }

  for (const dest of FEATURE_PLATE_DESTINATIONS) {
    const { x: px, y: py } = feature[dest]
    if (isPointInFeaturePlateViewportZone(x, y, px, py)) {
      candidates.push({
        destination: dest,
        depth: featurePlateViewportZoneDepth(x, y, px, py),
      })
    }
  }

  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.depth - b.depth)
  return candidates[0] ?? null
}

export function isPointInAnyCanvasPlateAcousticsZone(
  x: number,
  y: number,
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return true

  const studio = useStudioCentrePositionStore.getState()
  if (isPointInStudioPlateAcousticsZone(x, y, studio.x, studio.y)) return true

  const feature = useFeaturePlatePositionStore.getState().positions
  for (const dest of FEATURE_PLATE_DESTINATIONS) {
    const { x: px, y: py } = feature[dest]
    if (isPointInFeaturePlateAcousticsZone(x, y, px, py)) return true
  }
  return false
}

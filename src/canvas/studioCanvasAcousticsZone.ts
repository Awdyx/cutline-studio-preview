import {
  CANVAS_STUDIO_ACOUSTICS_EDGE_PAD,
  CANVAS_STUDIO_EDGE_FADE,
  STUDIO_VISUAL_HEIGHT,
  STUDIO_VISUAL_WIDTH,
} from '../drawing/canvasDimensions'
import { useStudioCentrePositionStore } from './studioCentrePositionStore'
import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { viewportCenterFullCanvas } from '../canvasItems/viewportCenter'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import { useCanvasStudioViewportZoneStore } from './canvasStudioViewportZoneStore'

/** Elliptical zone around the studio canvas — matches the void ramp (FAB chrome, etc.). */
export function studioCanvasViewportZoneEllipse(studioX: number, studioY: number) {
  return {
    cx: studioX + STUDIO_VISUAL_WIDTH / 2,
    cy: studioY + STUDIO_VISUAL_HEIGHT / 2,
    rx: STUDIO_VISUAL_WIDTH / 2 + CANVAS_STUDIO_EDGE_FADE,
    ry: STUDIO_VISUAL_HEIGHT / 2 + CANVAS_STUDIO_EDGE_FADE,
  }
}

/** Tighter zone for ambient music — muffling starts nearer the studio edge. */
export function studioCanvasAcousticsEllipse(studioX: number, studioY: number) {
  return {
    cx: studioX + STUDIO_VISUAL_WIDTH / 2,
    cy: studioY + STUDIO_VISUAL_HEIGHT / 2,
    rx: STUDIO_VISUAL_WIDTH / 2 + CANVAS_STUDIO_ACOUSTICS_EDGE_PAD,
    ry: STUDIO_VISUAL_HEIGHT / 2 + CANVAS_STUDIO_ACOUSTICS_EDGE_PAD,
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

/**
 * True when the viewport centre sits inside the studio ramp zone (main canvas).
 * Uses full canvas coordinates so panning into the void still resolves correctly.
 */
export function isViewportCenterNearStudioCanvas(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  viewportHost?: HTMLElement | null,
): boolean | null {
  const center = viewportCenterFullCanvas(transformRef, viewportHost)
  if (!center) return null
  return isPointInStudioCanvasViewportZone(center.x, center.y)
}

/** Track whether the live viewport sits near the studio canvas (main canvas only). */
export function syncStudioCanvasViewportZone(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  viewportRef: RefObject<HTMLElement | null>,
): void {
  const { setNearStudioViewport } = useCanvasStudioViewportZoneStore.getState()

  if (useCanvasWorkspaceStore.getState().isInsideSpace()) {
    setNearStudioViewport(true)
    return
  }

  const near = isViewportCenterNearStudioCanvas(transformRef, viewportRef.current)
  if (near == null) return
  setNearStudioViewport(near)
}

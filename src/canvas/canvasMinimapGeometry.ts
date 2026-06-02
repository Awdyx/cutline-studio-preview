import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CANVAS_ORIGINAL_HEIGHT,
  CANVAS_ORIGINAL_WIDTH,
} from '../drawing/canvasDimensions'
import { virtualCameraFromLibrary } from './canvasVirtualPan'
import { useStudioCentrePositionStore } from './studioCentrePositionStore'

export type CanvasMinimapRect = {
  x: number
  y: number
  width: number
  height: number
}

export type CanvasMinimapPercentRect = {
  left: number
  top: number
  width: number
  height: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Studio centre on the full canvas — reads live position from store. */
export function canvasMinimapStudioRect(): CanvasMinimapRect {
  const { x, y } = useStudioCentrePositionStore.getState()
  return {
    x,
    y,
    width: CANVAS_ORIGINAL_WIDTH,
    height: CANVAS_ORIGINAL_HEIGHT,
  }
}

export function canvasRectToMinimapPercent(
  rect: CanvasMinimapRect,
  canvasWidth = CANVAS_WIDTH,
  canvasHeight = CANVAS_HEIGHT,
): CanvasMinimapPercentRect {
  return {
    left: (rect.x / canvasWidth) * 100,
    top: (rect.y / canvasHeight) * 100,
    width: (rect.width / canvasWidth) * 100,
    height: (rect.height / canvasHeight) * 100,
  }
}

/** Map a canvas rect into percentages of a focus region (not the full canvas). */
export function canvasRectToRegionPercent(
  rect: CanvasMinimapRect,
  region: CanvasMinimapRect,
): CanvasMinimapPercentRect {
  if (region.width <= 0 || region.height <= 0) {
    return { left: 0, top: 0, width: 0, height: 0 }
  }
  return {
    left: ((rect.x - region.x) / region.width) * 100,
    top: ((rect.y - region.y) / region.height) * 100,
    width: (rect.width / region.width) * 100,
    height: (rect.height / region.height) * 100,
  }
}

/** Full canvas bounds for both collapsed and expanded minimaps. */
export function canvasMinimapMapRegion(): CanvasMinimapRect {
  return {
    x: 0,
    y: 0,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  }
}

/** Map bounds for the expanded minimap — studio moves within this region. */
export function canvasMinimapExpandedMapRegion(): CanvasMinimapRect {
  return canvasMinimapMapRegion()
}

export const CANVAS_MINIMAP_EXPANDED_WIDTH_PX = 600

/** Title row above the expanded minimap studio plate — keep in sync with menu layout. */
export const CANVAS_MINIMAP_PLATE_TITLE_LIFT_PX = 24

/** Modest trackpad boost while the expanded minimap menu is open (1 = normal). */
export const CANVAS_MINIMAP_TRACKPAD_PAN_MULTIPLIER = 2.2

export function canvasMinimapTrackpadPanBoost(): number {
  return CANVAS_MINIMAP_TRACKPAD_PAN_MULTIPLIER
}

/** @deprecated Expanded map uses full canvas; kept for tests/reference. */
export function canvasMinimapFocusRegion(
  studioX: number,
  studioY: number,
): CanvasMinimapRect {
  const padX = 5200
  const padY = 3800
  let x = studioX - padX
  let y = studioY - padY
  let width = CANVAS_ORIGINAL_WIDTH + padX * 2
  let height = CANVAS_ORIGINAL_HEIGHT + padY * 2

  if (x < 0) {
    width += x
    x = 0
  }
  if (y < 0) {
    height += y
    y = 0
  }
  if (x + width > CANVAS_WIDTH) {
    width = CANVAS_WIDTH - x
  }
  if (y + height > CANVAS_HEIGHT) {
    height = CANVAS_HEIGHT - y
  }

  return {
    x,
    y,
    width: Math.max(width, CANVAS_ORIGINAL_WIDTH),
    height: Math.max(height, CANVAS_ORIGINAL_HEIGHT),
  }
}

/** Visible wrapper viewport mapped into full-canvas coordinates. */
export function readCanvasMinimapViewport(
  ref: ReactZoomPanPinchContentRef | null,
  wrapperWidth: number,
  wrapperHeight: number,
  canvasWidth = CANVAS_WIDTH,
  canvasHeight = CANVAS_HEIGHT,
): CanvasMinimapRect | null {
  if (!ref?.state || wrapperWidth <= 0 || wrapperHeight <= 0) return null

  const { positionX, positionY, scale } = ref.state
  if (!Number.isFinite(scale) || scale <= 0) return null

  const virtual = virtualCameraFromLibrary({ positionX, positionY, scale })
  const x = clamp(-virtual.positionX / virtual.scale, 0, canvasWidth)
  const y = clamp(-virtual.positionY / virtual.scale, 0, canvasHeight)
  const right = clamp((wrapperWidth - virtual.positionX) / virtual.scale, 0, canvasWidth)
  const bottom = clamp((wrapperHeight - virtual.positionY) / virtual.scale, 0, canvasHeight)

  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  }
}

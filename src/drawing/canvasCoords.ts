import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  CANVAS_HEIGHT,
  CANVAS_ORIGINAL_HEIGHT,
  CANVAS_ORIGINAL_WIDTH,
  CANVAS_WIDTH,
  STUDIO_STROKE_BLEED_PAD,
} from './canvasDimensions'
import { useStudioCentrePositionStore } from '../canvas/studioCentrePositionStore'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import { isOverviewHyperPanActive } from '../canvas/canvasVirtualPan'
import {
  pocketStripBounds,
  pocketStripCenterY,
  POCKET_STRIP_STROKE_BLEED_PAD,
} from '../spaces/pocketStripDimensions'
import { readPocketStripState, usePocketStripStore } from '../spaces/pocketStripStore'
import { isCanvasCoordSane } from './penInput'

function pocketStripActive(): boolean {
  return useCanvasWorkspaceStore.getState().isInsideSpace()
}

function activeCanvasSize(): { width: number; height: number; bleedPad: number; minY: number } {
  if (pocketStripActive()) {
    const { logicalWidth } = readPocketStripState()
    const bounds = pocketStripBounds(logicalWidth)
    return {
      width: logicalWidth,
      height: bounds.maxY - bounds.minY,
      minY: bounds.minY,
      bleedPad: POCKET_STRIP_STROKE_BLEED_PAD,
    }
  }
  return {
    width: CANVAS_ORIGINAL_WIDTH,
    height: CANVAS_ORIGINAL_HEIGHT,
    minY: 0,
    bleedPad: STUDIO_STROKE_BLEED_PAD,
  }
}

/** Logical coords allowed while drawing — matches stroke SVG bleed. */
export function isStrokeBleedCoordSane(x: number, y: number): boolean {
  const { width, height, bleedPad } = activeCanvasSize()
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false
  if (pocketStripActive()) {
    const bounds = pocketStripBounds(width)
    return (
      x >= -bleedPad &&
      x <= width + bleedPad &&
      y >= bounds.minY - bleedPad &&
      y <= bounds.maxY + bleedPad
    )
  }
  return (
    x >= -bleedPad &&
    y >= -bleedPad &&
    x <= width + bleedPad &&
    y <= height + bleedPad
  )
}

function isActiveCanvasCoordSane(x: number, y: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false
  if (pocketStripActive()) {
    const { width } = activeCanvasSize()
    const bounds = pocketStripBounds(width)
    return (
      x >= -100 &&
      x <= width + 100 &&
      y >= bounds.minY - 100 &&
      y <= bounds.maxY + 100
    )
  }
  return isCanvasCoordSane(x, y, CANVAS_ORIGINAL_WIDTH, CANVAS_ORIGINAL_HEIGHT)
}

function mapRawToLogicalCoords(
  rawX: number,
  rawY: number,
): { x: number; y: number } {
  if (!pocketStripActive()) {
    return { x: rawX, y: rawY }
  }
  return {
    x: rawX,
    y: rawY - pocketStripCenterY(),
  }
}

function mapLogicalToRawCoords(
  x: number,
  y: number,
): { x: number; y: number } {
  if (!pocketStripActive()) {
    return { x, y }
  }
  return {
    x,
    y: y + pocketStripCenterY(),
  }
}

/**
 * Map screen → logical canvas coords for ink/erase.
 * Allows the full bleed zone past studio edges (items still use clientToCanvasFromElementForItem).
 */
export function clientToCanvasFromElementForStroke(
  clientX: number,
  clientY: number,
  canvasEl: HTMLElement,
): { x: number; y: number } | null {
  const pos = clientToCanvasFromElementRaw(clientX, clientY, canvasEl)
  if (!pos) return null
  if (!isStrokeBleedCoordSane(pos.x, pos.y)) return null
  return pos
}

/** Pointer tracking while dragging items — wide bleed so release outside still resolves. */
export function clientToCanvasFromElementForItem(
  clientX: number,
  clientY: number,
  canvasEl: HTMLElement,
): { x: number; y: number } | null {
  return clientToCanvasFromElementForStroke(clientX, clientY, canvasEl)
}

/** Screen delta → logical studio-local delta. */
export function screenDeltaToLogicalCanvas(
  sdx: number,
  sdy: number,
  canvasEl: HTMLElement,
): { dx: number; dy: number } {
  if (pocketStripActive()) {
    const scale = usePocketStripStore.getState().scale
    if (scale > 0) {
      return { dx: sdx / scale, dy: sdy / scale }
    }
  }

  const rect = canvasEl.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return { dx: 0, dy: 0 }
  return {
    dx: sdx * (canvasEl.offsetWidth / rect.width),
    dy: sdy * (canvasEl.offsetHeight / rect.height),
  }
}

/**
 * Map screen coords to canvas space using the canvas node's laid-out box.
 * Works even when pan/zoom state is mid-animation (avoids stale transform state).
 */
export function clientToCanvasFromElement(
  clientX: number,
  clientY: number,
  canvasEl: HTMLElement,
): { x: number; y: number } | null {
  const pos = clientToCanvasFromElementRaw(clientX, clientY, canvasEl)
  if (!pos) return null
  if (!isActiveCanvasCoordSane(pos.x, pos.y)) {
    return null
  }
  return pos
}

/** Canvas coords without studio-centre clamping — for free item drag. */
export function clientToCanvasFromElementRaw(
  clientX: number,
  clientY: number,
  canvasEl: HTMLElement,
): { x: number; y: number } | null {
  if (pocketStripActive()) {
    const scrollHost = usePocketStripStore.getState().scrollHost
    const { logicalWidth, scrollY, scale, viewportHeight } =
      usePocketStripStore.getState()
    if (scrollHost && logicalWidth > 0 && scale > 0 && viewportHeight > 0) {
      const hostRect = scrollHost.getBoundingClientRect()
      if (hostRect.width > 0 && hostRect.height > 0) {
        const x = ((clientX - hostRect.left) / hostRect.width) * logicalWidth
        const y =
          scrollY + (clientY - hostRect.top - hostRect.height / 2) / scale
        return { x, y }
      }
    }
  }

  const rect = canvasEl.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null

  const rawX = ((clientX - rect.left) / rect.width) * canvasEl.offsetWidth
  const rawY = ((clientY - rect.top) / rect.height) * canvasEl.offsetHeight
  return mapRawToLogicalCoords(rawX, rawY)
}

export function clientToCanvas(
  clientX: number,
  clientY: number,
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  canvasEl?: HTMLElement | null,
): { x: number; y: number } | null {
  if (canvasEl) {
    return clientToCanvasFromElement(clientX, clientY, canvasEl)
  }

  const ref = transformRef.current
  if (!ref) return null
  const wrapper = ref.instance.wrapperComponent
  if (!wrapper) return null

  const rect = wrapper.getBoundingClientRect()
  const { positionX, positionY, scale } = ref.state
  const localX = clientX - rect.left
  const localY = clientY - rect.top
  const insideSpace = pocketStripActive()
  const hyperPan = isOverviewHyperPanActive()
  const { x: offsetX, y: offsetY } = insideSpace || hyperPan
    ? { x: 0, y: 0 }
    : useStudioCentrePositionStore.getState()
  const layoutX = (localX - positionX) / scale - offsetX
  const layoutY = (localY - positionY) / scale - offsetY
  const mapped = mapRawToLogicalCoords(layoutX, layoutY)

  if (!isActiveCanvasCoordSane(mapped.x, mapped.y)) {
    return null
  }
  return mapped
}

/** Map transform layout coords → logical main-canvas coords (plates, zones). */
export function layoutToLogicalMainCanvas(
  layoutX: number,
  layoutY: number,
): { x: number; y: number } {
  return { x: layoutX, y: layoutY }
}

type CanvasPlateRect = {
  x: number
  y: number
  width: number
  height: number
}

/** Plates live in logical canvas space; pan/zoom math uses transform layout space. */
export function logicalMainCanvasPlateToLayoutRect(
  rect: CanvasPlateRect,
): CanvasPlateRect {
  return rect
}

/** Screen coords mapped to logical main-canvas space (not transform layout space). */
export function clientToFullCanvas(
  clientX: number,
  clientY: number,
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
): { x: number; y: number } | null {
  const ref = transformRef.current
  if (!ref) return null
  const wrapper = ref.instance.wrapperComponent
  if (!wrapper) return null

  const rect = wrapper.getBoundingClientRect()
  const { positionX, positionY, scale } = ref.state
  if (!Number.isFinite(scale) || scale <= 0) return null

  const localX = clientX - rect.left
  const localY = clientY - rect.top
  const layoutX = (localX - positionX) / scale
  const layoutY = (localY - positionY) / scale

  if (isOverviewHyperPanActive()) {
    const { x: studioX, y: studioY } = useStudioCentrePositionStore.getState()
    const x = studioX + layoutX
    const y = studioY + layoutY
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    return {
      x: Math.min(Math.max(0, x), CANVAS_WIDTH),
      y: Math.min(Math.max(0, y), CANVAS_HEIGHT),
    }
  }

  const { x, y } = layoutToLogicalMainCanvas(layoutX, layoutY)

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return {
    x: Math.min(Math.max(0, x), CANVAS_WIDTH),
    y: Math.min(Math.max(0, y), CANVAS_HEIGHT),
  }
}

export { mapLogicalToRawCoords, mapRawToLogicalCoords }

import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  CANVAS_EDGE_BLEED,
  CANVAS_HEIGHT,
  CANVAS_ORIGINAL_HEIGHT,
  CANVAS_ORIGINAL_WIDTH,
  CANVAS_WIDTH,
  STUDIO_STROKE_BLEED_PAD,
  studioVisualToLogical,
} from './canvasDimensions'
import { useStudioCentrePositionStore } from '../canvas/studioCentrePositionStore'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import { isCanvasCoordSane } from './penInput'

/** Logical coords allowed while drawing — matches STUDIO_STROKE_BLEED_PAD SVG bleed. */
export function isStrokeBleedCoordSane(x: number, y: number): boolean {
  const pad = STUDIO_STROKE_BLEED_PAD
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false
  return (
    x >= -pad &&
    y >= -pad &&
    x <= CANVAS_ORIGINAL_WIDTH + pad &&
    y <= CANVAS_ORIGINAL_HEIGHT + pad
  )
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
  const insideSpace = useCanvasWorkspaceStore.getState().isInsideSpace()
  const x = insideSpace ? pos.x : studioVisualToLogical(pos.x)
  const y = insideSpace ? pos.y : studioVisualToLogical(pos.y)
  if (!isStrokeBleedCoordSane(x, y)) return null
  return { x, y }
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
  const rect = canvasEl.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return { dx: 0, dy: 0 }
  let dx = sdx * (canvasEl.offsetWidth / rect.width)
  let dy = sdy * (canvasEl.offsetHeight / rect.height)
  if (!useCanvasWorkspaceStore.getState().isInsideSpace()) {
    dx = studioVisualToLogical(dx)
    dy = studioVisualToLogical(dy)
  }
  return { dx, dy }
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
  const insideSpace = useCanvasWorkspaceStore.getState().isInsideSpace()
  const x = insideSpace ? pos.x : studioVisualToLogical(pos.x)
  const y = insideSpace ? pos.y : studioVisualToLogical(pos.y)
  if (!isCanvasCoordSane(x, y, CANVAS_ORIGINAL_WIDTH, CANVAS_ORIGINAL_HEIGHT)) {
    return null
  }
  return { x, y }
}

/** Canvas coords without studio-centre clamping — for free item drag. */
export function clientToCanvasFromElementRaw(
  clientX: number,
  clientY: number,
  canvasEl: HTMLElement,
): { x: number; y: number } | null {
  const rect = canvasEl.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null

  return {
    x: ((clientX - rect.left) / rect.width) * canvasEl.offsetWidth,
    y: ((clientY - rect.top) / rect.height) * canvasEl.offsetHeight,
  }
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
  const insideSpace = useCanvasWorkspaceStore.getState().isInsideSpace()
  const { x: offsetX, y: offsetY } = insideSpace
    ? { x: 0, y: 0 }
    : useStudioCentrePositionStore.getState()
  const x = (localX - positionX) / scale - offsetX
  const y = (localY - positionY) / scale - offsetY
  const logicalX = insideSpace ? x : studioVisualToLogical(x)
  const logicalY = insideSpace ? y : studioVisualToLogical(y)

  if (!isCanvasCoordSane(logicalX, logicalY, CANVAS_ORIGINAL_WIDTH, CANVAS_ORIGINAL_HEIGHT)) {
    return null
  }
  return { x: logicalX, y: logicalY }
}

/** Bleed inset between transform layout space and the 15k×15k logical canvas. */
export function mainCanvasLogicalBleedOffset(): number {
  return useCanvasWorkspaceStore.getState().isInsideSpace() ? 0 : CANVAS_EDGE_BLEED
}

/** Map transform layout coords → logical main-canvas coords (plates, zones). */
export function layoutToLogicalMainCanvas(
  layoutX: number,
  layoutY: number,
): { x: number; y: number } {
  const bleed = mainCanvasLogicalBleedOffset()
  return { x: layoutX - bleed, y: layoutY - bleed }
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
  const bleed = mainCanvasLogicalBleedOffset()
  return {
    x: rect.x + bleed,
    y: rect.y + bleed,
    width: rect.width,
    height: rect.height,
  }
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
  const { x, y } = layoutToLogicalMainCanvas(layoutX, layoutY)

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return {
    x: Math.min(Math.max(0, x), CANVAS_WIDTH),
    y: Math.min(Math.max(0, y), CANVAS_HEIGHT),
  }
}

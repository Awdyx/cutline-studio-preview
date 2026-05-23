import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  CANVAS_HEIGHT,
  CANVAS_MAX_SCALE,
  CANVAS_WIDTH,
  getCanvasMinScale,
} from '../drawing/canvasDimensions'
import type { SpaceCamera } from '../spaces/types'

/** Persisted when the user has never panned/zoomed the main canvas. */
export const UNINITIALIZED_MAIN_CAMERA: SpaceCamera = {
  positionX: 0,
  positionY: 0,
  scale: 1,
}

export function isUninitializedMainCamera(
  camera: SpaceCamera | null | undefined,
): boolean {
  if (!camera) return true
  return (
    camera.positionX === UNINITIALIZED_MAIN_CAMERA.positionX &&
    camera.positionY === UNINITIALIZED_MAIN_CAMERA.positionY &&
    camera.scale === UNINITIALIZED_MAIN_CAMERA.scale
  )
}

function wrapperSize(ref: ReactZoomPanPinchContentRef): {
  width: number
  height: number
} | null {
  const wrapper = ref.instance.wrapperComponent
  if (!wrapper) return null
  const width = wrapper.offsetWidth
  const height = wrapper.offsetHeight
  if (width <= 0 || height <= 0) return null
  return { width, height }
}

/** Recalculate pan bounds from the library using the live wrapper DOM size. */
function syncLibraryBounds(ref: ReactZoomPanPinchContentRef): void {
  ref.instance.update(ref.instance.props)
}

type PanBounds = {
  minPositionX: number
  maxPositionX: number
  minPositionY: number
  maxPositionY: number
}

/** Pan limits for the cover-fit canvas (matches TransformWrapper config). */
function canvasPanBoundsForScale(
  wrapperWidth: number,
  wrapperHeight: number,
  scale: number,
): PanBounds {
  const contentWidth = CANVAS_WIDTH * scale
  const contentHeight = CANVAS_HEIGHT * scale

  // disablePadding + content fully visible inside wrapper
  if (wrapperWidth >= contentWidth && wrapperHeight >= contentHeight) {
    return {
      minPositionX: 0,
      maxPositionX: 0,
      minPositionY: 0,
      maxPositionY: 0,
    }
  }

  return {
    minPositionX: wrapperWidth - contentWidth,
    maxPositionX: 0,
    minPositionY: wrapperHeight - contentHeight,
    maxPositionY: 0,
  }
}

function clampPanPosition(
  positionX: number,
  positionY: number,
  bounds: PanBounds,
): { positionX: number; positionY: number } {
  return {
    positionX: Math.max(
      bounds.minPositionX,
      Math.min(bounds.maxPositionX, positionX),
    ),
    positionY: Math.max(
      bounds.minPositionY,
      Math.min(bounds.maxPositionY, positionY),
    ),
  }
}

function clampToLibraryBounds(
  ref: ReactZoomPanPinchContentRef,
): SpaceCamera | null {
  const bounds = ref.instance.bounds
  const { positionX, positionY, scale } = ref.state
  if (!bounds) return readCameraFromRef(ref)

  const x = Math.max(
    bounds.minPositionX,
    Math.min(bounds.maxPositionX, positionX),
  )
  const y = Math.max(
    bounds.minPositionY,
    Math.min(bounds.maxPositionY, positionY),
  )

  if (x !== positionX || y !== positionY) {
    ref.setTransform(x, y, scale, 0)
    syncLibraryBounds(ref)
  }

  return readCameraFromRef(ref)
}

/**
 * Ensure scale covers the wrapper (no letterboxing) and reclamp pan.
 * Keeps the canvas point at the viewport center stable when scale increases.
 */
function enforceCoverFit(
  ref: ReactZoomPanPinchContentRef,
): SpaceCamera | null {
  const size = wrapperSize(ref)
  if (!size) return null

  const minScale = getCanvasMinScale(size.width, size.height)
  const { positionX, positionY, scale } = ref.state
  const nextScale = Math.max(scale, minScale)

  let nextX = positionX
  let nextY = positionY

  if (nextScale !== scale) {
    const centerCanvasX = (size.width / 2 - positionX) / scale
    const centerCanvasY = (size.height / 2 - positionY) / scale
    nextX = size.width / 2 - centerCanvasX * nextScale
    nextY = size.height / 2 - centerCanvasY * nextScale
  }

  if (nextScale !== scale || nextX !== positionX || nextY !== positionY) {
    ref.setTransform(nextX, nextY, nextScale, 0)
  }

  syncLibraryBounds(ref)
  return clampToLibraryBounds(ref)
}

/** Read the camera from transform state. */
export function readCameraFromRef(
  ref: ReactZoomPanPinchContentRef | null,
): SpaceCamera | null {
  if (!ref) return null
  const { positionX, positionY, scale } = ref.state
  if (
    !Number.isFinite(scale) ||
    !Number.isFinite(positionX) ||
    !Number.isFinite(positionY) ||
    scale <= 0
  ) {
    return null
  }
  return { positionX, positionY, scale }
}

/** Reject cameras saved while the wrapper was mis-sized (canvas px instead of screen). */
export function isCameraPlausible(
  camera: SpaceCamera,
  ref: ReactZoomPanPinchContentRef | null,
): boolean {
  const size = ref ? wrapperSize(ref) : null
  const width = size?.width ?? window.innerWidth
  const height = size?.height ?? window.innerHeight
  const minScale = getCanvasMinScale(width, height)

  if (camera.scale < minScale * 0.85 || camera.scale > CANVAS_MAX_SCALE * 1.05) {
    return false
  }

  // Rough sanity: position magnitude shouldn't exceed scaled canvas size.
  const maxPan = Math.max(CANVAS_MAX_SCALE * 2000, width * 4)
  if (
    Math.abs(camera.positionX) > maxPan ||
    Math.abs(camera.positionY) > maxPan
  ) {
    return false
  }

  return true
}

/** Center at min cover scale using the library (reads wrapper/content DOM). */
export function resetToCoverFit(
  ref: ReactZoomPanPinchContentRef | null,
): SpaceCamera | null {
  if (!ref) return null
  const size = wrapperSize(ref)
  if (!size) return null

  const minScale = getCanvasMinScale(size.width, size.height)
  ref.centerView(minScale, 0)
  syncLibraryBounds(ref)
  return readCameraFromRef(ref)
}

/** Apply pan/zoom; always sync bounds through the library, never manual bounds. */
export function applyCameraToRef(
  ref: ReactZoomPanPinchContentRef | null,
  camera: SpaceCamera,
  options?: { centerIfUninitialized?: boolean },
): void {
  if (!ref) return
  const size = wrapperSize(ref)
  if (!size) return

  if (
    options?.centerIfUninitialized &&
    isUninitializedMainCamera(camera)
  ) {
    resetToCoverFit(ref)
    return
  }

  if (!isCameraPlausible(camera, ref)) {
    resetToCoverFit(ref)
    return
  }

  const minScale = getCanvasMinScale(size.width, size.height)
  const scale = Math.min(
    CANVAS_MAX_SCALE,
    Math.max(minScale, camera.scale),
  )

  ref.setTransform(camera.positionX, camera.positionY, scale, 0)
  syncLibraryBounds(ref)
  clampToLibraryBounds(ref)
}

/** Pan the viewport so the item's center sits in the wrapper center. */
export function focusItemOnCanvas(
  ref: ReactZoomPanPinchContentRef | null,
  item: { x: number; y: number; width: number; height: number },
  options?: { animationMs?: number; scale?: number },
): void {
  if (!ref) return
  const size = wrapperSize(ref)
  if (!size) return

  const scale = options?.scale ?? ref.state.scale
  const cx = item.x + item.width / 2
  const cy = item.y + item.height / 2
  const animationMs = options?.animationMs ?? 420

  const bounds = canvasPanBoundsForScale(size.width, size.height, scale)
  const { positionX, positionY } = clampPanPosition(
    size.width / 2 - cx * scale,
    size.height / 2 - cy * scale,
    bounds,
  )

  ref.setTransform(positionX, positionY, scale, animationMs)
  syncLibraryBounds(ref)

  if (animationMs > 0) {
    window.setTimeout(() => {
      clampToLibraryBounds(ref)
    }, animationMs + 32)
  } else {
    clampToLibraryBounds(ref)
  }
}

/** After wrapper resize: refresh min scale and reclamp current camera. */
export function refitCameraAfterResize(
  ref: ReactZoomPanPinchContentRef | null,
): number | null {
  if (!ref) return null
  const size = wrapperSize(ref)
  if (!size) return null

  enforceCoverFit(ref)
  return getCanvasMinScale(size.width, size.height)
}

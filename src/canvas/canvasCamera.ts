import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { isPhoneLayout } from '../platform/layoutProfile'
import { PHONE_HEADER_BLOCK_HEIGHT } from '../styles/phoneChrome'
import {
  CANVAS_HEIGHT,
  CANVAS_MAX_SCALE,
  CANVAS_WIDTH,
  CANVAS_ZOOM_EDGE_PADDING,
  canvasLayoutHeight,
  canvasLayoutWidth,
  getCanvasMinScale,
  getCanvasHardMinScale,
} from '../drawing/canvasDimensions'
import type { SpaceCamera } from '../spaces/types'
import { EMPTY_EDGE_STRENGTHS } from '../canvasPanVignette'
import { usePanMotionStore } from '../panMotionStore'
import { logicalMainCanvasPlateToLayoutRect } from '../drawing/canvasCoords'
import { canvasItemTransformRect } from '../spaces/spaceCardRect'

export type FocusItemRect = {
  x: number
  y: number
  width: number
  height: number
}

export type FocusItemOptions = {
  animationMs?: number
  scale?: number
  screenOffsetY?: number
  /** Scale and pan so the full item fits in the viewport with padding. */
  fit?: boolean
  /** Eased pan with a slight arc (uses RAF; implies simultaneous scale when fit is set). */
  curved?: boolean
  fitPaddingX?: number
  fitPaddingTop?: number
  fitPaddingBottom?: number
  /** Fit zoom may exceed CANVAS_MAX_SCALE (study-hub menu focus). */
  bypassMaxScale?: boolean
  /** Allow pan past canvas edges so edge items can center (study-hub menu focus). */
  bypassPanBounds?: boolean
  /** Rect is a main-canvas plate in logical 15k space (not a studio-local item). */
  mainCanvasPlate?: boolean
  /** Per animation frame — screen-space pan delta (px), for motion/sfx hooks. */
  onMotionFrame?: (dx: number, dy: number) => void
  onComplete?: () => void
}

const FOCUS_FIT_PADDING_X = 40
const FOCUS_FIT_PADDING_X_PHONE = 12
const FOCUS_FIT_PADDING_TOP_DESKTOP = 56
const FOCUS_FIT_PADDING_BOTTOM = 48
const FOCUS_FIT_PADDING_BOTTOM_PHONE = 52
const FOCUS_FIT_PHONE_HEADER_CLEARANCE = 8
/** Tighter than FOCUS_FIT_PADDING_BOTTOM — study-hub menu focus zooms in a touch more. */
const STUDY_HUB_MENU_FOCUS_EDGE_GAP = 26

/** Typical transform maxScale from TransformWrapper (hard max + edge padding). */
const TRANSFORM_MAX_SCALE = CANVAS_MAX_SCALE + CANVAS_ZOOM_EDGE_PADDING

let savedTransformMaxScale: number | null = null
let savedLimitToBounds: boolean | null = null

/** Raise the library zoom ceiling so menu-focus fit animations can exceed CANVAS_MAX_SCALE. */
export function elevateTransformMaxScale(
  ref: ReactZoomPanPinchContentRef,
  neededScale: number,
): void {
  if (savedTransformMaxScale === null) {
    savedTransformMaxScale = ref.instance.setup.maxScale
  }
  ref.instance.setup.maxScale = Math.max(neededScale, TRANSFORM_MAX_SCALE)
}

/** Let menu-focus fit pan past canvas edges so near-edge hubs can center. */
export function relaxTransformPanBounds(
  ref: ReactZoomPanPinchContentRef,
): void {
  if (savedLimitToBounds === null) {
    savedLimitToBounds = ref.instance.setup.limitToBounds ?? true
  }
  ref.instance.setup.limitToBounds = false
}

/** Restore the normal zoom ceiling and pan limits after menu-focus dismiss. */
export function restoreTransformMaxScale(
  ref: ReactZoomPanPinchContentRef | null,
): void {
  if (!ref) return
  ref.instance.setup.maxScale = savedTransformMaxScale ?? TRANSFORM_MAX_SCALE
  savedTransformMaxScale = null
  if (savedLimitToBounds !== null) {
    ref.instance.setup.limitToBounds = savedLimitToBounds
    savedLimitToBounds = null
  }
  syncLibraryBounds(ref)
}

let activeFocusRaf: number | null = null

const CAMERA_FOCUS_ANIM_ATTR = 'data-camera-focus-anim'

function beginCameraFocusAnimBlur(): void {
  document.documentElement.setAttribute(CAMERA_FOCUS_ANIM_ATTR, '')
  usePanMotionStore.getState().setCameraFlyActive(true)
}

function endCameraFocusAnimBlur(): void {
  document.documentElement.removeAttribute(CAMERA_FOCUS_ANIM_ATTR)
  usePanMotionStore.getState().setCameraFlyActive(false)
  usePanMotionStore.getState().setPanStopped()
}

export function cancelFocusItemAnimation(): void {
  if (activeFocusRaf !== null) {
    cancelAnimationFrame(activeFocusRaf)
    activeFocusRaf = null
    endCameraFocusAnimBlur()
  }
}

function cubicBezierComponent(a: number, b: number, t: number): number {
  const u = 1 - t
  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t
}

/** CSS cubic-bezier(x1,y1,x2,y2) — progress in [0,1] → eased value in [0,1]. */
function cubicBezierEase(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (progress: number) => number {
  return (progress: number) => {
    if (progress <= 0) return 0
    if (progress >= 1) return 1
    let lo = 0
    let hi = 1
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2
      if (cubicBezierComponent(x1, x2, mid) < progress) lo = mid
      else hi = mid
    }
    const t = (lo + hi) / 2
    return cubicBezierComponent(y1, y2, t)
  }
}

/** Fly-to destination — quick takeoff, long soft landing (matches chrome motion). */
const easeCameraFocusIn = cubicBezierEase(0.22, 1, 0.36, 1)
/** Pull back / dismiss — sustained glide (matches minimap plate navigate). */
const easeCameraFocusOut = cubicBezierEase(0.37, 0, 0.21, 1)

function cubicPoint(a: number, b: number, c: number, d: number, t: number): number {
  const u = 1 - t
  return (
    u * u * u * a +
    3 * u * u * t * b +
    3 * u * t * t * c +
    t * t * t * d
  )
}

function focusDurationMs(
  start: SpaceCamera,
  end: SpaceCamera,
  requestedMs?: number,
): number {
  if (requestedMs != null) return requestedMs
  const panDist = Math.hypot(end.positionX - start.positionX, end.positionY - start.positionY)
  const scaleDelta = Math.abs(end.scale - start.scale)
  return Math.min(920, Math.max(620, 520 + panDist * 0.045 + scaleDelta * 280))
}

/** Padded viewport area used by fit-to-item camera math. */
export function focusFitAvailableViewportSize(
  ref: ReactZoomPanPinchContentRef,
  paddingOverrides?: Pick<
    FocusItemOptions,
    'fitPaddingX' | 'fitPaddingTop' | 'fitPaddingBottom'
  >,
): { width: number; height: number; aspect: number } | null {
  const size = wrapperSize(ref)
  if (!size) return null

  const padding = defaultFitPadding()
  const paddingX = paddingOverrides?.fitPaddingX ?? padding.paddingX
  const paddingTop = paddingOverrides?.fitPaddingTop ?? padding.paddingTop
  const paddingBottom =
    paddingOverrides?.fitPaddingBottom ?? padding.paddingBottom

  const width = Math.max(1, size.width - paddingX * 2)
  const height = Math.max(1, size.height - paddingTop - paddingBottom)
  return { width, height, aspect: width / height }
}

/** Fit padding for study-hub menu focus — equal gap below search bar and above viewport bottom. */
export function studyHubMenuFocusFitPadding(): Pick<
  FocusItemOptions,
  'fitPaddingTop' | 'fitPaddingBottom'
> {
  const paddingBottom = isPhoneLayout()
    ? FOCUS_FIT_PADDING_BOTTOM_PHONE - 16
    : STUDY_HUB_MENU_FOCUS_EDGE_GAP

  if (isPhoneLayout()) {
    return {
      fitPaddingTop:
        PHONE_HEADER_BLOCK_HEIGHT + FOCUS_FIT_PHONE_HEADER_CLEARANCE,
      fitPaddingBottom: paddingBottom,
    }
  }

  const searchBar = document.querySelector('[data-ui-anchor="search-bar"]')
  const chromeBottom =
    searchBar instanceof HTMLElement
      ? searchBar.getBoundingClientRect().bottom
      : FOCUS_FIT_PADDING_TOP_DESKTOP

  return {
    fitPaddingTop: chromeBottom + paddingBottom,
    fitPaddingBottom: paddingBottom,
  }
}

/** Fit options for study-hub menu focus — bypasses the normal canvas zoom cap. */
export function studyHubMenuFocusFitOptions(): FocusItemOptions {
  return {
    fit: true,
    curved: true,
    bypassMaxScale: true,
    bypassPanBounds: true,
    ...studyHubMenuFocusFitPadding(),
  }
}

function defaultFitPadding(): {
  paddingX: number
  paddingTop: number
  paddingBottom: number
} {
  if (isPhoneLayout()) {
    return {
      paddingX: FOCUS_FIT_PADDING_X_PHONE,
      paddingTop:
        PHONE_HEADER_BLOCK_HEIGHT +
        FOCUS_FIT_PHONE_HEADER_CLEARANCE,
      paddingBottom: FOCUS_FIT_PADDING_BOTTOM_PHONE,
    }
  }
  return {
    paddingX: FOCUS_FIT_PADDING_X,
    paddingTop: FOCUS_FIT_PADDING_TOP_DESKTOP,
    paddingBottom: FOCUS_FIT_PADDING_BOTTOM,
  }
}

/** Camera that fits an item inside the viewport with even padding. */
export function computeCameraToFitItem(
  ref: ReactZoomPanPinchContentRef,
  item: FocusItemRect,
  options?: Pick<
    FocusItemOptions,
    | 'fitPaddingX'
    | 'fitPaddingTop'
    | 'fitPaddingBottom'
    | 'screenOffsetY'
    | 'scale'
    | 'bypassMaxScale'
    | 'bypassPanBounds'
  >,
): SpaceCamera | null {
  const size = wrapperSize(ref)
  if (!size) return null

  const padding = defaultFitPadding()
  const paddingX = options?.fitPaddingX ?? padding.paddingX
  const paddingTop = options?.fitPaddingTop ?? padding.paddingTop
  const paddingBottom = options?.fitPaddingBottom ?? padding.paddingBottom
  const screenOffsetY = options?.screenOffsetY ?? 0

  const availW = Math.max(1, size.width - paddingX * 2)
  const availH = Math.max(1, size.height - paddingTop - paddingBottom)
  const fitScale = Math.min(availW / item.width, availH / item.height)

  const minScale = getCanvasMinScale(size.width, size.height)
  const hardMax = options?.bypassMaxScale
    ? Number.POSITIVE_INFINITY
    : CANVAS_MAX_SCALE
  const scale =
    options?.scale ??
    Math.min(hardMax, Math.max(minScale, fitScale))

  const viewCenterX = paddingX + availW / 2
  const viewCenterY = paddingTop + availH / 2 + screenOffsetY
  const cx = item.x + item.width / 2
  const cy = item.y + item.height / 2

  const positionX = viewCenterX - cx * scale
  const positionY = viewCenterY - cy * scale

  if (options?.bypassPanBounds) {
    return { positionX, positionY, scale }
  }

  const bounds = canvasPanBoundsForScale(size.width, size.height, scale)
  const clamped = clampPanPosition(positionX, positionY, bounds)
  return { ...clamped, scale }
}

function animateCameraTo(
  ref: ReactZoomPanPinchContentRef,
  target: SpaceCamera,
  options?: {
    curved?: boolean
    animationMs?: number
    onComplete?: () => void
    onMotionFrame?: (dx: number, dy: number) => void
    bypassMaxScale?: boolean
    bypassPanBounds?: boolean
    restoreTransformMaxScale?: boolean
  },
): void {
  cancelFocusItemAnimation()
  cancelLibraryAnimation(ref)

  const start = readCameraFromRef(ref)
  if (!start) return

  beginCameraFocusAnimBlur()

  if (options?.bypassMaxScale) {
    elevateTransformMaxScale(ref, target.scale)
  }
  if (options?.bypassPanBounds) {
    relaxTransformPanBounds(ref)
  }

  const duration = focusDurationMs(start, target, options?.animationMs)
  const startTime = performance.now()

  const panDx = target.positionX - start.positionX
  const panDy = target.positionY - start.positionY
  const panLen = Math.hypot(panDx, panDy)
  const scaleDelta = target.scale - start.scale
  const zoomingIn = scaleDelta > start.scale * 0.012
  const zoomingOut = scaleDelta < -start.scale * 0.012
  const panEase = zoomingOut ? easeCameraFocusOut : easeCameraFocusIn

  const arcStrength = options?.curved
    ? Math.min(300, Math.max(48, panLen * 0.34))
    : 0
  const perpX = panLen > 0 ? (-panDy / panLen) * arcStrength : 0
  const perpY = panLen > 0 ? (panDx / panLen) * arcStrength : 0
  const arcCtrl1X = start.positionX + panDx * 0.22 + perpX * 0.85
  const arcCtrl1Y = start.positionY + panDy * 0.22 + perpY * 0.85
  const arcCtrl2X = start.positionX + panDx * 0.78 + perpX * 0.55
  const arcCtrl2Y = start.positionY + panDy * 0.78 + perpY * 0.55
  let prevX = start.positionX
  let prevY = start.positionY

  const tick = (now: number) => {
    const rawT = Math.min(1, (now - startTime) / duration)
    const panT = panEase(rawT)

    let scaleRawT = rawT
    if (zoomingIn) {
      scaleRawT = Math.min(1, Math.max(0, (rawT - 0.14) / 0.86))
    } else if (zoomingOut) {
      scaleRawT = Math.min(1, rawT / 0.82)
    }
    const scaleT = panEase(scaleRawT)
    let nextScale = start.scale + scaleDelta * scaleT
    if (zoomingIn && rawT > 0.68 && rawT < 1) {
      const settle = Math.sin(((rawT - 0.68) / 0.32) * Math.PI)
      nextScale += scaleDelta * 0.035 * settle
    }

    const nextX = options?.curved
      ? cubicPoint(
          start.positionX,
          arcCtrl1X,
          arcCtrl2X,
          target.positionX,
          panT,
        )
      : start.positionX + panDx * panT
    const nextY = options?.curved
      ? cubicPoint(
          start.positionY,
          arcCtrl1Y,
          arcCtrl2Y,
          target.positionY,
          panT,
        )
      : start.positionY + panDy * panT

    const frameDx = nextX - prevX
    const frameDy = nextY - prevY
    options?.onMotionFrame?.(frameDx, frameDy)
    usePanMotionStore
      .getState()
      .setPanFrame(frameDx, frameDy, EMPTY_EDGE_STRENGTHS)
    prevX = nextX
    prevY = nextY

    ref.setTransform(nextX, nextY, nextScale, 0)

    if (rawT < 1) {
      activeFocusRaf = requestAnimationFrame(tick)
      return
    }

    ref.setTransform(target.positionX, target.positionY, target.scale, 0)
    syncLibraryBounds(ref)
    if (!options?.bypassPanBounds) {
      clampToLibraryBounds(ref)
    }
    activeFocusRaf = null
    if (options?.restoreTransformMaxScale) {
      restoreTransformMaxScale(ref)
    }
    endCameraFocusAnimBlur()
    options?.onComplete?.()
  }

  activeFocusRaf = requestAnimationFrame(tick)
}

/** Animate pan/zoom to an explicit camera (e.g. restore after menu focus). */
export function animateCameraToTarget(
  ref: ReactZoomPanPinchContentRef | null,
  target: SpaceCamera,
  options?: {
    curved?: boolean
    animationMs?: number
    onComplete?: () => void
    restoreTransformMaxScale?: boolean
  },
): void {
  if (!ref) return
  animateCameraTo(ref, target, options)
}

/** Trackpad pinch / modifier wheel step (matches react-zoom-pan-pinch smooth wheel). */
export const CANVAS_WHEEL_ZOOM_STEP = 0.017

/** Persisted when the user has never panned/zoomed the main canvas. */
export const UNINITIALIZED_MAIN_CAMERA: SpaceCamera = {
  positionX: 0,
  positionY: 0,
  scale: 1,
}

export function isUninitializedMainCamera(
  camera: SpaceCamera | null | undefined,
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight,
): boolean {
  if (!camera) return true
  if (
    camera.positionX === UNINITIALIZED_MAIN_CAMERA.positionX &&
    camera.positionY === UNINITIALIZED_MAIN_CAMERA.positionY &&
    camera.scale === UNINITIALIZED_MAIN_CAMERA.scale
  ) {
    return true
  }
  // TransformWrapper default pan before the first centering pass — often persisted
  // at cover-fit scale, which would reload into the top-left corner otherwise.
  if (camera.positionX === 0 && camera.positionY === 0) {
    const minScale = getCanvasMinScale(viewportWidth, viewportHeight)
    if (camera.scale >= minScale * 0.95) return true
  }
  return false
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

type CancelableInstance = ReactZoomPanPinchContentRef['instance'] & {
  animation: unknown
  isAnimating: boolean
  velocity: unknown
  velocityTime: number | null
}

/**
 * Mirror the library's internal `handleCancelAnimation`: stop the running
 * velocity / pan-bounce RAF loop so our `setTransform(..., 0)` isn't
 * overwritten by the next animation tick.
 */
export function cancelLibraryAnimation(ref: ReactZoomPanPinchContentRef): void {
  const instance = ref.instance as CancelableInstance
  if (!instance.mounted) return
  const anim = instance.animation
  if (typeof anim === 'number') cancelAnimationFrame(anim)
  instance.animation = null
  instance.isAnimating = false
  instance.velocity = null
  instance.velocityTime = null
}

/** Apply a trackpad wheel delta to the canvas camera (screen-space pan). */
export function applyCanvasTrackpadPanDelta(
  ref: ReactZoomPanPinchContentRef,
  deltaX: number,
  deltaY: number,
  sensitivity = 1,
): boolean {
  if (deltaX === 0 && deltaY === 0) return false

  cancelLibraryAnimation(ref)
  const { positionX, positionY, scale } = ref.state
  const nextX = positionX - deltaX * sensitivity
  const nextY = positionY - deltaY * sensitivity
  if (nextX === positionX && nextY === positionY) return false

  ref.setTransform(nextX, nextY, scale, 0)
  syncLibraryBounds(ref)
  clampToLibraryBounds(ref)
  return true
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
  const contentWidth = canvasLayoutWidth() * scale
  const contentHeight = canvasLayoutHeight() * scale

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

  const minScale = getCanvasHardMinScale(size.width, size.height)
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

/**
 * Zoom anchored to a wrapper-local point (typically the cursor). Falling back
 * to the viewport center keeps callers without a cursor working unchanged.
 * Matches smooth wheel delta scaling from react-zoom-pan-pinch.
 */
export function applyAnchoredWheelZoom(
  ref: ReactZoomPanPinchContentRef,
  deltaY: number,
  anchor: { x: number; y: number } | null,
  step = CANVAS_WHEEL_ZOOM_STEP,
): boolean {
  const wrapper = ref.instance.wrapperComponent
  if (!wrapper) return false

  const { positionX, positionY, scale } = ref.state
  const { minScale, maxScale } = ref.instance.setup
  const delta = deltaY < 0 ? 1 : -1
  const zoomStep = step * Math.abs(deltaY)
  const nextScale = Math.min(maxScale, Math.max(minScale, scale + delta * zoomStep))

  if (nextScale === scale) return false

  const width = wrapper.offsetWidth
  const height = wrapper.offsetHeight
  const anchorX = anchor ? anchor.x : width / 2
  const anchorY = anchor ? anchor.y : height / 2
  const canvasAnchorX = (anchorX - positionX) / scale
  const canvasAnchorY = (anchorY - positionY) / scale
  const nextX = anchorX - canvasAnchorX * nextScale
  const nextY = anchorY - canvasAnchorY * nextScale

  // Interrupt any in-progress velocity / pan-bounce animation so our zoom
  // doesn't get overwritten one frame later.
  cancelLibraryAnimation(ref)
  ref.setTransform(nextX, nextY, nextScale, 0)
  syncLibraryBounds(ref)
  return true
}

/** Re-sync + clamp to library bounds (used after manual setTransform animations). */
export function settleCanvasBounds(ref: ReactZoomPanPinchContentRef | null): void {
  if (!ref) return
  syncLibraryBounds(ref)
  clampToLibraryBounds(ref)
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
  const hardMin = getCanvasHardMinScale(width, height)

  if (camera.scale < hardMin * 0.85 || camera.scale > CANVAS_MAX_SCALE * 1.05) {
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

/** Center at min cover scale — main canvas spawns on the 15k canvas centre. */
export function resetToCoverFit(
  ref: ReactZoomPanPinchContentRef | null,
): SpaceCamera | null {
  if (!ref) return null
  const size = wrapperSize(ref)
  if (!size) return null

  const minScale = getCanvasMinScale(size.width, size.height)
  const content = ref.instance.contentComponent
  const contentWidth = content?.offsetWidth ?? 0
  const isMainExpandedCanvas = contentWidth >= canvasLayoutWidth() - 1

  if (isMainExpandedCanvas) {
    focusItemOnCanvas(
      ref,
      {
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT / 2,
        width: 0,
        height: 0,
      },
      { mainCanvasPlate: true, scale: minScale, animationMs: 0 },
    )
    return readCameraFromRef(ref)
  }

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

  const minScale = getCanvasHardMinScale(size.width, size.height)
  const scale = Math.min(
    CANVAS_MAX_SCALE,
    Math.max(minScale, camera.scale),
  )

  ref.setTransform(camera.positionX, camera.positionY, scale, 0)
  syncLibraryBounds(ref)
  clampToLibraryBounds(ref)
}

/** Apply a saved camera verbatim — used when leaving a pocket back to the main canvas. */
export function applyCameraExact(
  ref: ReactZoomPanPinchContentRef | null,
  camera: SpaceCamera,
): void {
  if (!ref) return
  if (
    !Number.isFinite(camera.scale) ||
    !Number.isFinite(camera.positionX) ||
    !Number.isFinite(camera.positionY) ||
    camera.scale <= 0
  ) {
    return
  }
  ref.setTransform(camera.positionX, camera.positionY, camera.scale, 0)
  syncLibraryBounds(ref)
  clampToLibraryBounds(ref)
}

/** Wait for expanded canvas dimensions, then restore the pre-pocket main camera. */
export function restoreMainCameraAfterPocketExit(
  ref: ReactZoomPanPinchContentRef | null,
  camera: SpaceCamera,
  options?: { onComplete?: () => void; attempt?: number },
): void {
  if (!ref) return
  const attempt = options?.attempt ?? 0
  const content = ref.instance.contentComponent
  const contentWidth = content?.offsetWidth ?? 0
  const contentHeight = content?.offsetHeight ?? 0
  const expandedReady =
    contentWidth >= canvasLayoutWidth() - 1 &&
    contentHeight >= canvasLayoutHeight() - 1

  if (expandedReady || attempt >= 16) {
    applyCameraExact(ref, camera)
    options?.onComplete?.()
    return
  }

  requestAnimationFrame(() =>
    restoreMainCameraAfterPocketExit(ref, camera, {
      ...options,
      attempt: attempt + 1,
    }),
  )
}

/** Pan the viewport so the item is centered; optionally fit and animate with a curve. */
function focusRectForOptions(
  item: FocusItemRect,
  options?: FocusItemOptions,
): FocusItemRect {
  if (options?.mainCanvasPlate) {
    return logicalMainCanvasPlateToLayoutRect(item)
  }
  return canvasItemTransformRect(item)
}

export function focusItemOnCanvas(
  ref: ReactZoomPanPinchContentRef | null,
  item: FocusItemRect,
  options?: FocusItemOptions,
): void {
  if (!ref) return
  const size = wrapperSize(ref)
  if (!size) return

  const canvasItem = focusRectForOptions(item, options)

  if (options?.fit) {
    const target = computeCameraToFitItem(ref, canvasItem, options)
    if (!target) return
    animateCameraTo(ref, target, {
      curved: options.curved,
      animationMs: options.animationMs,
      bypassMaxScale: options.bypassMaxScale,
      bypassPanBounds: options.bypassPanBounds,
      onMotionFrame: options.onMotionFrame,
      onComplete: options.onComplete,
    })
    return
  }

  const scale = options?.scale ?? ref.state.scale
  const cx = canvasItem.x + canvasItem.width / 2
  const cy = canvasItem.y + canvasItem.height / 2
  const animationMs = options?.animationMs ?? 420
  const screenOffsetY = options?.screenOffsetY ?? 0

  const bounds = canvasPanBoundsForScale(size.width, size.height, scale)
  const { positionX, positionY } = clampPanPosition(
    size.width / 2 - cx * scale,
    size.height / 2 + screenOffsetY - cy * scale,
    bounds,
  )

  if (options?.curved) {
    animateCameraTo(
      ref,
      { positionX, positionY, scale },
      {
        curved: true,
        animationMs,
        onMotionFrame: options.onMotionFrame,
        onComplete: options.onComplete,
      },
    )
    return
  }

  cancelFocusItemAnimation()
  cancelLibraryAnimation(ref)
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

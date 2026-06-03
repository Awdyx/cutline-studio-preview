import { CANVAS_FOCUS_BACKDROP_BLUR_PX } from '../styles/tokens'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { isPhoneLayout } from '../platform/layoutProfile'
import { PHONE_HEADER_BLOCK_HEIGHT } from '../styles/phoneChrome'
import {
  CANVAS_MAX_SCALE,
  CANVAS_ZOOM_EDGE_PADDING,
  canvasLayoutHeight,
  canvasLayoutWidth,
  getCanvasMinScale,
  getCanvasHardMinScale,
} from '../drawing/canvasDimensions'
import type { SpaceCamera } from '../spaces/types'
import { logicalMainCanvasPlateToLayoutRect } from '../drawing/canvasCoords'
import { canvasItemTransformRect } from '../spaces/spaceCardRect'
import { studyHubDimensionsForWidth, studyHubSpawnDimensions } from '../canvasItems/studyHubBounds'
import { studyHubOutsideControlsOverflowPx } from '../canvasItems/StudyHubMenuOutsideControls'
import { STUDY_HUB_ASPECT } from '../canvasItems/types'
import {
  libraryCameraFromVirtual,
  virtualCameraFromLibrary,
  virtualPanContentSize,
} from './canvasVirtualPan'

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
  /** Fit zoom may go below cover-fit minScale so large hubs can shrink to fit. */
  bypassMinScale?: boolean
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
let savedTransformMinScale: number | null = null
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

/** Lower the library zoom floor so menu-focus fit can shrink oversized hubs. */
export function relaxTransformMinScale(
  ref: ReactZoomPanPinchContentRef,
  neededScale: number,
): void {
  if (savedTransformMinScale === null) {
    savedTransformMinScale = ref.instance.setup.minScale
  }
  ref.instance.setup.minScale = Math.min(
    savedTransformMinScale,
    neededScale * 0.85,
  )
}

/** Restore the normal zoom ceiling and pan limits after menu-focus dismiss. */
export function restoreTransformMaxScale(
  ref: ReactZoomPanPinchContentRef | null,
): void {
  if (!ref) return
  ref.instance.setup.maxScale = savedTransformMaxScale ?? TRANSFORM_MAX_SCALE
  savedTransformMaxScale = null
  if (savedTransformMinScale !== null) {
    ref.instance.setup.minScale = savedTransformMinScale
    savedTransformMinScale = null
  }
  if (savedLimitToBounds !== null) {
    ref.instance.setup.limitToBounds = savedLimitToBounds
    savedLimitToBounds = null
  }
  syncLibraryBounds(ref)
}

let activeFocusRaf: number | null = null

export function cancelFocusItemAnimation(): void {
  if (activeFocusRaf !== null) {
    cancelAnimationFrame(activeFocusRaf)
    activeFocusRaf = null
  }
}

function easeInOutCubic(t: number): number {
  const u = 1 - t
  return 1 - u * u * u * u * u
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

function quadraticPoint(a: number, b: number, c: number, t: number): number {
  const u = 1 - t
  return u * u * a + 2 * u * t * b + t * t * c
}

function focusDurationMs(
  start: SpaceCamera,
  end: SpaceCamera,
  requestedMs?: number,
): number {
  if (requestedMs != null) return requestedMs
  const panDist = Math.hypot(end.positionX - start.positionX, end.positionY - start.positionY)
  const scaleDelta = Math.abs(end.scale - start.scale)
  return Math.min(720, Math.max(460, 400 + panDist * 0.06 + scaleDelta * 260))
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
    bypassMinScale: true,
    bypassPanBounds: true,
    ...studyHubMenuFocusFitPadding(),
  }
}

function studyHubMenuFocusHubWidthForAvail(availW: number, availH: number): number {
  return availW / STUDY_HUB_ASPECT <= availH
    ? availW
    : availH * STUDY_HUB_ASPECT
}

function studyHubMenuFocusHorizontalPadding(): {
  paddingLeft: number
  paddingRightBase: number
} {
  const padding = isPhoneLayout() ? FOCUS_FIT_PADDING_X_PHONE : FOCUS_FIT_PADDING_X
  return { paddingLeft: padding, paddingRightBase: padding }
}

/** Avail width/height for menu-focus layout — reserves space for outside X / pen controls. */
function studyHubMenuFocusAvailSize(
  viewportW: number,
  viewportH: number,
  paddingTop: number,
  paddingBottom: number,
): { availW: number; availH: number; hubWidth: number } {
  const { paddingLeft, paddingRightBase } = studyHubMenuFocusHorizontalPadding()
  let availW = Math.max(1, viewportW - paddingLeft - paddingRightBase)
  const availH = Math.max(1, viewportH - paddingTop - paddingBottom)

  let hubWidth = studyHubMenuFocusHubWidthForAvail(availW, availH)
  const controlsReserve = studyHubOutsideControlsOverflowPx(hubWidth)
  availW = Math.max(1, viewportW - paddingLeft - paddingRightBase - controlsReserve)
  hubWidth = studyHubMenuFocusHubWidthForAvail(availW, availH)

  return { availW, availH, hubWidth }
}

/** Canvas-space size for a hub that fills the menu-focus frame (shortcut spawns). */
export function studyHubMenuFocusSpawnDimensions(
  ref: ReactZoomPanPinchContentRef | null,
): { width: number; height: number } {
  if (!ref) {
    return studyHubSpawnDimensions(1)
  }

  const size = wrapperSize(ref)
  if (!size) {
    return studyHubSpawnDimensions(1)
  }

  const { fitPaddingTop, fitPaddingBottom } = studyHubMenuFocusFitPadding()
  const paddingTop = fitPaddingTop ?? FOCUS_FIT_PADDING_TOP_DESKTOP
  const paddingBottom = fitPaddingBottom ?? FOCUS_FIT_PADDING_BOTTOM
  const { hubWidth } = studyHubMenuFocusAvailSize(
    size.width,
    size.height,
    paddingTop,
    paddingBottom,
  )

  return studyHubDimensionsForWidth(hubWidth)
}

/** Fixed screen rect for the menu-focus frame (ephemeral shortcut overlay). */
export function studyHubMenuFocusScreenRect(
  ref: ReactZoomPanPinchContentRef | null,
): DOMRect | null {
  if (!ref) return null
  const size = wrapperSize(ref)
  const wrapper = ref.instance.wrapperComponent
  if (!size || !wrapper) return null

  const wrapperBounds = wrapper.getBoundingClientRect()
  const { fitPaddingTop, fitPaddingBottom } = studyHubMenuFocusFitPadding()
  const paddingTop = fitPaddingTop ?? FOCUS_FIT_PADDING_TOP_DESKTOP
  const paddingBottom = fitPaddingBottom ?? FOCUS_FIT_PADDING_BOTTOM
  const { paddingLeft } = studyHubMenuFocusHorizontalPadding()
  const { availW, availH, hubWidth: width } = studyHubMenuFocusAvailSize(
    size.width,
    size.height,
    paddingTop,
    paddingBottom,
  )
  const height = width / STUDY_HUB_ASPECT
  const left = wrapperBounds.left + paddingLeft + (availW - width) / 2
  const top = wrapperBounds.top + paddingTop + (availH - height) / 2

  return new DOMRect(left, top, width, height)
}

/** Base selection blur — keep in sync with `.ui-selection-depth` in index.css. */
export const SELECTION_DEPTH_BLUR_PX = CANVAS_FOCUS_BACKDROP_BLUR_PX

/**
 * Ephemeral study hubs skip the menu-focus camera zoom; boost blur so it matches
 * the scaled selection overlay you get after a placed hub flies in.
 */
export function studyHubEphemeralSelectionBlurPx(
  ref: ReactZoomPanPinchContentRef | null,
): number {
  if (!ref?.state) return SELECTION_DEPTH_BLUR_PX

  const currentScale = ref.state.scale
  if (!Number.isFinite(currentScale) || currentScale <= 0) {
    return SELECTION_DEPTH_BLUR_PX
  }

  const dims = studyHubMenuFocusSpawnDimensions(ref)
  const target = computeCameraToFitItem(
    ref,
    { x: 0, y: 0, width: dims.width, height: dims.height },
    studyHubMenuFocusFitOptions(),
  )
  if (!target) return SELECTION_DEPTH_BLUR_PX

  const ratio = target.scale / currentScale
  if (!Number.isFinite(ratio) || ratio <= 1) return SELECTION_DEPTH_BLUR_PX

  return Math.min(SELECTION_DEPTH_BLUR_PX * 3, SELECTION_DEPTH_BLUR_PX * ratio)
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
    | 'bypassMinScale'
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
  const scale = options?.scale
    ? options.scale
    : options?.bypassMinScale
      ? Math.min(hardMax, fitScale)
      : Math.min(hardMax, Math.max(minScale, fitScale))

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
    bypassMinScale?: boolean
    bypassPanBounds?: boolean
    restoreTransformMaxScale?: boolean
  },
): void {
  cancelFocusItemAnimation()
  cancelLibraryAnimation(ref)

  const start = readCameraFromRef(ref)
  if (!start) return

  if (options?.bypassMaxScale) {
    elevateTransformMaxScale(ref, target.scale)
  }
  if (options?.bypassMinScale) {
    relaxTransformMinScale(ref, target.scale)
  }
  if (options?.bypassPanBounds) {
    relaxTransformPanBounds(ref)
  }

  const duration = focusDurationMs(start, target, options?.animationMs)
  const startTime = performance.now()

  const arcStrength = options?.curved
    ? Math.min(120, Math.hypot(target.positionX - start.positionX, target.positionY - start.positionY) * 0.22)
    : 0
  const midX = (start.positionX + target.positionX) / 2
  const midY = (start.positionY + target.positionY) / 2
  const panDx = target.positionX - start.positionX
  const panDy = target.positionY - start.positionY
  const panLen = Math.hypot(panDx, panDy)
  const perpX = panLen > 0 ? (-panDy / panLen) * arcStrength : 0
  const perpY = panLen > 0 ? (panDx / panLen) * arcStrength : 0
  const ctrlX = midX + perpX
  const ctrlY = midY + perpY
  let prevX = start.positionX
  let prevY = start.positionY

  const tick = (now: number) => {
    const rawT = Math.min(1, (now - startTime) / duration)
    const t = easeInOutCubic(rawT)
    const nextScale = start.scale + (target.scale - start.scale) * t
    const nextX = options?.curved
      ? quadraticPoint(start.positionX, ctrlX, target.positionX, t)
      : start.positionX + (target.positionX - start.positionX) * t
    const nextY = options?.curved
      ? quadraticPoint(start.positionY, ctrlY, target.positionY, t)
      : start.positionY + (target.positionY - start.positionY) * t

    options?.onMotionFrame?.(nextX - prevX, nextY - prevY)
    prevX = nextX
    prevY = nextY

    writeCameraTransform(ref, nextX, nextY, nextScale, 0)

    if (rawT < 1) {
      activeFocusRaf = requestAnimationFrame(tick)
      return
    }

    writeCameraTransform(
      ref,
      target.positionX,
      target.positionY,
      target.scale,
      0,
    )
    syncLibraryBounds(ref)
    if (!options?.bypassPanBounds) {
      clampToLibraryBounds(ref)
    }
    activeFocusRaf = null
    if (options?.restoreTransformMaxScale) {
      restoreTransformMaxScale(ref)
    }
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
): boolean {
  if (!camera) return true
  return (
    camera.positionX === UNINITIALIZED_MAIN_CAMERA.positionX &&
    camera.positionY === UNINITIALIZED_MAIN_CAMERA.positionY &&
    camera.scale === UNINITIALIZED_MAIN_CAMERA.scale
  )
}

/** Library default before centerView — top-left of the bleed, not the studio. */
export function isDefaultUncenteredCamera(
  camera: SpaceCamera,
  ref: ReactZoomPanPinchContentRef | null,
): boolean {
  const size = ref ? wrapperSize(ref) : null
  if (!size) return false
  const minScale = getCanvasMinScale(size.width, size.height)
  const atDefaultScale = Math.abs(camera.scale - minScale) < 0.004
  const atOrigin =
    Math.abs(camera.positionX) < 0.75 && Math.abs(camera.positionY) < 0.75
  return atDefaultScale && atOrigin
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
export function syncLibraryBounds(ref: ReactZoomPanPinchContentRef): void {
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

type DirectTransformInstance = ReactZoomPanPinchContentRef['instance'] & {
  state: SpaceCamera
  contentComponent?: HTMLElement | null
  handleTransformStyles?: (x: number, y: number, scale: number) => string
}

/**
 * Write pan/zoom straight to the transform layer. Required when TransformWrapper
 * is disabled (direct pan mode) because the library's setTransform early-returns.
 */
export function applyDirectCameraTransform(
  ref: ReactZoomPanPinchContentRef,
  positionX: number,
  positionY: number,
  scale: number,
): void {
  const instance = ref.instance as DirectTransformInstance
  if (!instance?.state) return

  cancelLibraryAnimation(ref)
  instance.state.positionX = positionX
  instance.state.positionY = positionY
  instance.state.scale = scale
  ref.state.positionX = positionX
  ref.state.positionY = positionY
  ref.state.scale = scale

  const content = instance.contentComponent
  if (content) {
    const transform =
      typeof instance.handleTransformStyles === 'function'
        ? instance.handleTransformStyles(positionX, positionY, scale)
        : `translate(${positionX}px, ${positionY}px) scale(${scale})`
    content.style.transform = transform
  }
}

/** Pan/zoom write that works in both library and direct-input modes. */
export function writeCameraTransform(
  ref: ReactZoomPanPinchContentRef,
  positionX: number,
  positionY: number,
  scale: number,
  animationMs = 0,
): void {
  const virtual = { positionX, positionY, scale }
  const library = libraryCameraFromVirtual(virtual)
  writeLibraryCameraTransform(
    ref,
    library.positionX,
    library.positionY,
    library.scale,
    animationMs,
  )
}

/** Write library-space transform without virtual conversion. */
export function writeLibraryCameraTransform(
  ref: ReactZoomPanPinchContentRef,
  positionX: number,
  positionY: number,
  scale: number,
  animationMs = 0,
): void {
  if (ref.instance.setup.disabled) {
    applyDirectCameraTransform(ref, positionX, positionY, scale)
    return
  }
  ref.setTransform(positionX, positionY, scale, animationMs)
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
  const virtual = virtualCameraFromLibrary(ref.state)
  const nextX = virtual.positionX - deltaX * sensitivity
  const nextY = virtual.positionY - deltaY * sensitivity
  if (nextX === virtual.positionX && nextY === virtual.positionY) return false

  writeCameraTransform(ref, nextX, nextY, virtual.scale, 0)
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

/** Transform content size in native layout pixels. */
function activeTransformLayoutSize(): { width: number; height: number } {
  return {
    width: canvasLayoutWidth(),
    height: canvasLayoutHeight(),
  }
}

/** Pan limits for the cover-fit canvas (matches TransformWrapper limitToBounds). */
export function canvasPanBoundsForScale(
  wrapperWidth: number,
  wrapperHeight: number,
  scale: number,
): PanBounds {
  const { width: contentWidth, height: contentHeight } = activeTransformLayoutSize()
  const scaledWidth = contentWidth * scale
  const scaledHeight = contentHeight * scale

  // disablePadding + content fully visible inside wrapper
  if (wrapperWidth >= scaledWidth && wrapperHeight >= scaledHeight) {
    return {
      minPositionX: 0,
      maxPositionX: 0,
      minPositionY: 0,
      maxPositionY: 0,
    }
  }

  return {
    minPositionX: wrapperWidth - scaledWidth,
    maxPositionX: 0,
    minPositionY: wrapperHeight - scaledHeight,
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

/** Live pan limits from layout size + wrapper (not stale library bounds). */
export function readCanvasPanBounds(
  ref: ReactZoomPanPinchContentRef,
): PanBounds | null {
  const size = wrapperSize(ref)
  const scale = ref.state?.scale
  if (!size || !Number.isFinite(scale) || scale <= 0) return null
  return canvasPanBoundsForScale(size.width, size.height, scale)
}

export function clampToLibraryBounds(
  ref: ReactZoomPanPinchContentRef,
): SpaceCamera | null {
  const bounds = readCanvasPanBounds(ref)
  const virtual = virtualCameraFromLibrary(ref.state)
  if (!bounds) return readCameraFromRef(ref)

  const { positionX: x, positionY: y } = clampPanPosition(
    virtual.positionX,
    virtual.positionY,
    bounds,
  )

  if (x !== virtual.positionX || y !== virtual.positionY) {
    writeCameraTransform(ref, x, y, virtual.scale, 0)
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
  const virtual = virtualCameraFromLibrary(ref.state)
  const nextScale = Math.max(virtual.scale, minScale)

  let nextX = virtual.positionX
  let nextY = virtual.positionY

  if (nextScale !== virtual.scale) {
    const centerCanvasX = (size.width / 2 - virtual.positionX) / virtual.scale
    const centerCanvasY = (size.height / 2 - virtual.positionY) / virtual.scale
    nextX = size.width / 2 - centerCanvasX * nextScale
    nextY = size.height / 2 - centerCanvasY * nextScale
  }

  if (
    nextScale !== virtual.scale ||
    nextX !== virtual.positionX ||
    nextY !== virtual.positionY
  ) {
    writeCameraTransform(ref, nextX, nextY, nextScale, 0)
  }

  syncLibraryBounds(ref)
  return clampToLibraryBounds(ref)
}

const ZOOM_RELEASE_MS = 320

let activeZoomSnapRaf: number | null = null

function cancelZoomSnapAnimation(): void {
  if (activeZoomSnapRaf !== null) {
    cancelAnimationFrame(activeZoomSnapRaf)
    activeZoomSnapRaf = null
  }
}

/** Ease scale back after zoom overshoot past hard min/max (viewport center held). */
function snapZoomOvershoot(
  ref: ReactZoomPanPinchContentRef,
  hardMin: number,
): boolean {
  const virtual = virtualCameraFromLibrary(ref.state)
  let targetScale: number | null = null
  if (virtual.scale < hardMin - 0.003) targetScale = hardMin
  else if (virtual.scale > CANVAS_MAX_SCALE + 0.003) targetScale = CANVAS_MAX_SCALE
  if (targetScale == null) return false

  const size = wrapperSize(ref)
  if (!size) return false

  cancelLibraryAnimation(ref)
  cancelZoomSnapAnimation()

  const cx = (size.width / 2 - virtual.positionX) / virtual.scale
  const cy = (size.height / 2 - virtual.positionY) / virtual.scale
  const startScale = virtual.scale
  const targetX = size.width / 2 - cx * targetScale
  const targetY = size.height / 2 - cy * targetScale
  const startTime = performance.now()

  const tick = (now: number) => {
    const rawT = Math.min(1, (now - startTime) / ZOOM_RELEASE_MS)
    const eased = easeOutCubic(rawT)
    const nextScale = startScale + (targetScale - startScale) * eased
    writeCameraTransform(
      ref,
      size.width / 2 - cx * nextScale,
      size.height / 2 - cy * nextScale,
      nextScale,
      0,
    )

    if (rawT < 1) {
      activeZoomSnapRaf = requestAnimationFrame(tick)
      return
    }

    writeCameraTransform(ref, targetX, targetY, targetScale, 0)
    activeZoomSnapRaf = null
    syncLibraryBounds(ref)
  }

  activeZoomSnapRaf = requestAnimationFrame(tick)
  return true
}

export function releaseZoomBounds(
  ref: ReactZoomPanPinchContentRef,
  hardMin: number,
): void {
  if (snapZoomOvershoot(ref, hardMin)) {
    window.setTimeout(() => clampToLibraryBounds(ref), ZOOM_RELEASE_MS + 20)
    return
  }
  clampToLibraryBounds(ref)
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
  const nextLibX = anchorX - canvasAnchorX * nextScale
  const nextLibY = anchorY - canvasAnchorY * nextScale
  const nextVirtual = virtualCameraFromLibrary({
    positionX: nextLibX,
    positionY: nextLibY,
    scale: nextScale,
  })

  // Interrupt any in-progress velocity / pan-bounce / zoom-snap animation.
  cancelLibraryAnimation(ref)
  cancelZoomSnapAnimation()
  writeCameraTransform(
    ref,
    nextVirtual.positionX,
    nextVirtual.positionY,
    nextVirtual.scale,
    0,
  )
  syncLibraryBounds(ref)
  return true
}

/** Re-sync + clamp to library bounds (used after manual setTransform animations). */
export function settleCanvasBounds(ref: ReactZoomPanPinchContentRef | null): void {
  if (!ref) return
  syncLibraryBounds(ref)
  clampToLibraryBounds(ref)
}

/** Read the camera from transform state (virtual void coords on main canvas). */
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
  return virtualCameraFromLibrary({ positionX, positionY, scale })
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

  const minScale = getCanvasHardMinScale(size.width, size.height)
  const scale = Math.min(
    CANVAS_MAX_SCALE,
    Math.max(minScale, camera.scale),
  )

  writeCameraTransform(ref, camera.positionX, camera.positionY, scale, 0)
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
  writeCameraTransform(
    ref,
    camera.positionX,
    camera.positionY,
    camera.scale,
    0,
  )
  syncLibraryBounds(ref)
  clampToLibraryBounds(ref)
}

export function isTransformLayoutReady(
  ref: ReactZoomPanPinchContentRef | null,
  expectedWidth: number,
  expectedHeight: number,
  mode: 'enter' | 'exit' | 'any' = 'any',
): boolean {
  if (!ref) return true
  const content = ref.instance.contentComponent
  const contentWidth = content?.offsetWidth ?? 0
  const contentHeight = content?.offsetHeight ?? 0

  const widthMatches =
    mode === 'enter'
      ? contentWidth <= expectedWidth + 1 && contentWidth >= expectedWidth - 1
      : contentWidth >= expectedWidth - 1 && contentWidth <= expectedWidth + 1
  const heightMatches =
    mode === 'enter'
      ? contentHeight <= expectedHeight + 1 &&
        contentHeight >= expectedHeight - 1
      : contentHeight >= expectedHeight - 1 &&
        contentHeight <= expectedHeight + 1

  return widthMatches && heightMatches
}

/**
 * Synchronous layout poll for useLayoutEffect — apply before paint when the DOM
 * resize and camera conversion must land in the same frame.
 */
export function applyCameraWhenTransformLayoutReadySync(
  ref: ReactZoomPanPinchContentRef | null,
  expectedWidth: number,
  expectedHeight: number,
  apply: () => void,
  maxAttempts = 48,
  mode: 'enter' | 'exit' | 'any' = 'any',
): boolean {
  if (!ref) {
    apply()
    return true
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (isTransformLayoutReady(ref, expectedWidth, expectedHeight, mode)) {
      apply()
      return true
    }
    void ref.instance.contentComponent?.offsetHeight
  }

  return false
}

/** Wait until transform content matches expected layout size, then run `apply`. */
export function applyCameraWhenTransformLayoutReady(
  ref: ReactZoomPanPinchContentRef | null,
  expectedWidth: number,
  expectedHeight: number,
  apply: () => void,
  attempt = 0,
  mode: 'enter' | 'exit' | 'any' = 'any',
): void {
  if (!ref) {
    apply()
    return
  }

  const layoutReady = isTransformLayoutReady(ref, expectedWidth, expectedHeight, mode)

  if (layoutReady || attempt >= 16) {
    apply()
    return
  }

  requestAnimationFrame(() =>
    applyCameraWhenTransformLayoutReady(
      ref,
      expectedWidth,
      expectedHeight,
      apply,
      attempt + 1,
      mode,
    ),
  )
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
      bypassMinScale: options.bypassMinScale,
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
  writeCameraTransform(ref, positionX, positionY, scale, animationMs)
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

import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  CANVAS_MAX_SCALE,
  getCanvasHardMinScale,
  getCanvasMinScale,
} from '../drawing/canvasDimensions'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import type { SpaceCamera } from '../spaces/types'
import {
  BARREL_DISPLACEMENT_PX,
  CANVAS_BARREL_FILTER_ID,
  barrelEngageScale,
  barrelExitScale,
  isBarrelEngaged,
} from './canvasBarrelStrength'
import {
  cancelLibraryAnimation,
  settleCanvasBounds,
} from './canvasCamera'
import { useCanvasFisheyeStore } from './canvasFisheyeStore'

export const CANVAS_BARREL_HOST_ATTR = 'data-canvas-barrel-host'
export const CANVAS_BARREL_ACTIVE_ATTR = 'data-canvas-barrel-active'
const DISPLACEMENT_NODE_ID = `${CANVAS_BARREL_FILTER_ID}-map`

/** Fade duration when zoom gestures cross the threshold (ms). */
const TWEEN_MS = 360
/** Combined zoom + warp transition duration (ms). */
export const CANVAS_FISHEYE_TRANSITION_MS = 560
const EXIT_MS = CANVAS_FISHEYE_TRANSITION_MS
const ENTER_MS = EXIT_MS

let tweenRaf = 0
let exitRaf = 0
let enterRaf = 0
let currentPx = 0
let targetPx = 0
let exitLockUntil = 0

function host(): Element | null {
  return document.querySelector(`[${CANVAS_BARREL_HOST_ATTR}]`)
}

function applyPx(px: number): void {
  const node = document.getElementById(DISPLACEMENT_NODE_ID)
  const h = host()
  if (!node || !h) return
  node.setAttribute('scale', px.toFixed(2))
  if (px > 0.05) h.setAttribute(CANVAS_BARREL_ACTIVE_ATTR, '')
  else h.removeAttribute(CANVAS_BARREL_ACTIVE_ATTR)
}

let barrelWarmed = false

/**
 * Pre-build the barrel filter once after load. The first time `filter: url(#…)`
 * is attached to the host the browser has to decode the displacement map and
 * allocate the filter buffer; until that first rasterisation lands the warped
 * edges flash black (only cleared by a later repaint such as a pan). Briefly
 * applying the filter at a 1px scale ahead of time does that build up front so
 * the first real fisheye engage is already clean.
 */
export function warmCanvasBarrelFilter(): void {
  if (barrelWarmed) return
  const node = document.getElementById(DISPLACEMENT_NODE_ID)
  const h = host()
  if (!node || !h) return
  barrelWarmed = true

  // A restore may have already engaged the overview — then it's warm already.
  if (h.hasAttribute(CANVAS_BARREL_ACTIVE_ATTR)) return

  node.setAttribute('scale', '1')
  h.setAttribute(CANVAS_BARREL_ACTIVE_ATTR, '')

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Leave it alone if a real engage started while warming.
      if (currentPx > 0.05) return
      node.setAttribute('scale', '0')
      h.removeAttribute(CANVAS_BARREL_ACTIVE_ATTR)
    })
  })
}

function tweenTo(px: number): void {
  if (px === targetPx && (tweenRaf || currentPx === px)) return
  targetPx = px
  const from = currentPx
  const start = performance.now()
  if (tweenRaf) cancelAnimationFrame(tweenRaf)

  const step = (now: number) => {
    const t = Math.min(1, (now - start) / TWEEN_MS)
    const eased = t * t * (3 - 2 * t)
    currentPx = from + (targetPx - from) * eased
    applyPx(currentPx)
    if (t < 1) {
      tweenRaf = requestAnimationFrame(step)
    } else {
      tweenRaf = 0
      currentPx = targetPx
      applyPx(currentPx)
    }
  }
  tweenRaf = requestAnimationFrame(step)
}

function wrapperSize(
  ref: ReactZoomPanPinchContentRef,
): { width: number; height: number } {
  const wrapper = ref.instance?.wrapperComponent
  if (wrapper && wrapper.offsetWidth > 0 && wrapper.offsetHeight > 0) {
    return { width: wrapper.offsetWidth, height: wrapper.offsetHeight }
  }
  return { width: window.innerWidth, height: window.innerHeight }
}

/**
 * After reload / camera restore: keep pan position but zoom in past the fisheye
 * band so the overview warp does not auto-engage from persisted scale alone.
 */
export function ensureNotInFisheyeOverview(
  ref: ReactZoomPanPinchContentRef | null,
): void {
  if (!ref) return
  const scale = ref.state?.scale
  if (!Number.isFinite(scale)) return

  const { width, height } = wrapperSize(ref)
  const minScale = getCanvasMinScale(width, height)
  if (!isBarrelEngaged(scale, minScale)) return

  const toScale = barrelExitScale(minScale)
  const startX = ref.state.positionX
  const startY = ref.state.positionY
  const ax = width / 2
  const ay = height / 2
  const canvasAx = (ax - startX) / scale
  const canvasAy = (ay - startY) / scale
  ref.setTransform(ax - canvasAx * toScale, ay - canvasAy * toScale, toScale, 0)
  settleCanvasBounds(ref)
}

/** Sync engagement + filter to the live zoom; binary at the engage threshold. */
export function updateCanvasBarrelAfterCamera(
  ref: ReactZoomPanPinchContentRef | null,
  options?: { silent?: boolean },
): void {
  if (!ref) return
  if (performance.now() < exitLockUntil) return
  const scale = ref.state?.scale
  if (!Number.isFinite(scale)) return

  const { width, height } = wrapperSize(ref)
  const engaged = isBarrelEngaged(scale, getCanvasMinScale(width, height))
  useCanvasFisheyeStore.getState().setEngaged(engaged, { silent: options?.silent })
  tweenTo(engaged ? BARREL_DISPLACEMENT_PX : 0)
}

/**
 * Tap-to-exit overview: one synced animation that eases the zoom in (anchored
 * at the tap) while warping the fisheye out, so the filter never snaps off.
 */
export function runCanvasFisheyeExit(
  ref: ReactZoomPanPinchContentRef | null,
  anchor: { x: number; y: number } | null,
): void {
  if (!ref) return
  const wrapper = ref.instance?.wrapperComponent
  const scale = ref.state?.scale
  if (!wrapper || !Number.isFinite(scale)) return

  exitLockUntil = performance.now() + EXIT_MS + 140
  useCanvasFisheyeStore.getState().setEngaged(false)
  if (tweenRaf) {
    cancelAnimationFrame(tweenRaf)
    tweenRaf = 0
  }
  if (enterRaf) {
    cancelAnimationFrame(enterRaf)
    enterRaf = 0
  }
  cancelLibraryAnimation(ref)

  const width = wrapper.offsetWidth
  const height = wrapper.offsetHeight
  const startScale = scale
  const toScale = barrelExitScale(getCanvasMinScale(width, height))
  const startX = ref.state.positionX
  const startY = ref.state.positionY
  const rect = wrapper.getBoundingClientRect()
  const ax = anchor ? anchor.x - rect.left : width / 2
  const ay = anchor ? anchor.y - rect.top : height / 2
  const canvasAx = (ax - startX) / startScale
  const canvasAy = (ay - startY) / startScale
  const startPx = currentPx
  targetPx = 0
  const start = performance.now()

  const loop = (now: number) => {
    const t = Math.min(1, (now - start) / EXIT_MS)
    const easeZoom = 1 - (1 - t) ** 3
    const easeFade = t * t * (3 - 2 * t)
    const s = startScale + (toScale - startScale) * easeZoom
    ref.setTransform(ax - canvasAx * s, ay - canvasAy * s, s, 0)
    currentPx = startPx * (1 - easeFade)
    applyPx(currentPx)
    if (t < 1) {
      exitRaf = requestAnimationFrame(loop)
    } else {
      exitRaf = 0
      currentPx = 0
      applyPx(0)
      settleCanvasBounds(ref)
    }
  }

  if (exitRaf) cancelAnimationFrame(exitRaf)
  exitRaf = requestAnimationFrame(loop)
}

/**
 * Zoom into the fisheye overview band (viewport centre anchor) with the barrel
 * warp easing in — used when opening the canvas map from normal zoom.
 */
export function runCanvasFisheyeEnter(
  ref: ReactZoomPanPinchContentRef | null,
  anchor: { x: number; y: number } | null,
): void {
  if (!ref) return
  const wrapper = ref.instance?.wrapperComponent
  const scale = ref.state?.scale
  if (!wrapper || !Number.isFinite(scale)) return

  const width = wrapper.offsetWidth
  const height = wrapper.offsetHeight
  const minScale = getCanvasMinScale(width, height)
  const toScale = barrelEngageScale(minScale)

  if (isBarrelEngaged(scale, minScale)) {
    updateCanvasBarrelAfterCamera(ref)
    return
  }

  exitLockUntil = performance.now() + ENTER_MS + 140
  useCanvasFisheyeStore.getState().setEngaged(true)
  if (tweenRaf) {
    cancelAnimationFrame(tweenRaf)
    tweenRaf = 0
  }
  if (exitRaf) {
    cancelAnimationFrame(exitRaf)
    exitRaf = 0
  }
  cancelLibraryAnimation(ref)

  const startScale = scale
  const startX = ref.state.positionX
  const startY = ref.state.positionY
  const rect = wrapper.getBoundingClientRect()
  const ax = anchor ? anchor.x - rect.left : width / 2
  const ay = anchor ? anchor.y - rect.top : height / 2
  const canvasAx = (ax - startX) / startScale
  const canvasAy = (ay - startY) / startScale
  const startPx = currentPx
  targetPx = BARREL_DISPLACEMENT_PX
  const start = performance.now()

  const loop = (now: number) => {
    const t = Math.min(1, (now - start) / ENTER_MS)
    const easeZoom = 1 - (1 - t) ** 3
    const easeFade = t * t * (3 - 2 * t)
    const s = startScale + (toScale - startScale) * easeZoom
    ref.setTransform(ax - canvasAx * s, ay - canvasAy * s, s, 0)
    currentPx = startPx + (targetPx - startPx) * easeFade
    applyPx(currentPx)
    if (t < 1) {
      enterRaf = requestAnimationFrame(loop)
    } else {
      enterRaf = 0
      currentPx = targetPx
      applyPx(targetPx)
      settleCanvasBounds(ref)
    }
  }

  if (enterRaf) cancelAnimationFrame(enterRaf)
  enterRaf = requestAnimationFrame(loop)
}

/**
 * Leave fisheye while animating back to an exact saved camera — used when
 * dismissing the canvas map opened via ⌘M from standard zoom.
 */
export function runCanvasFisheyeExitToCamera(
  ref: ReactZoomPanPinchContentRef | null,
  target: SpaceCamera,
): void {
  if (!ref) return
  const wrapper = ref.instance?.wrapperComponent
  const scale = ref.state?.scale
  if (!wrapper || !Number.isFinite(scale)) return

  exitLockUntil = performance.now() + EXIT_MS + 140
  useCanvasFisheyeStore.getState().setEngaged(false, { silent: true })
  if (tweenRaf) {
    cancelAnimationFrame(tweenRaf)
    tweenRaf = 0
  }
  if (enterRaf) {
    cancelAnimationFrame(enterRaf)
    enterRaf = 0
  }
  cancelLibraryAnimation(ref)

  const width = wrapper.offsetWidth
  const height = wrapper.offsetHeight
  const hardMin = getCanvasHardMinScale(width, height)
  const startScale = scale
  const toScale = Math.min(
    CANVAS_MAX_SCALE,
    Math.max(hardMin, target.scale),
  )
  const startX = ref.state.positionX
  const startY = ref.state.positionY
  const toX = target.positionX
  const toY = target.positionY
  const startPx = currentPx
  targetPx = 0
  const start = performance.now()

  const loop = (now: number) => {
    const t = Math.min(1, (now - start) / EXIT_MS)
    const easeZoom = 1 - (1 - t) ** 3
    const easeFade = t * t * (3 - 2 * t)
    const s = startScale + (toScale - startScale) * easeZoom
    const x = startX + (toX - startX) * easeZoom
    const y = startY + (toY - startY) * easeZoom
    ref.setTransform(x, y, s, 0)
    currentPx = startPx * (1 - easeFade)
    applyPx(currentPx)
    if (t < 1) {
      exitRaf = requestAnimationFrame(loop)
    } else {
      exitRaf = 0
      currentPx = 0
      applyPx(0)
      ref.setTransform(toX, toY, toScale, 0)
      settleCanvasBounds(ref)
      useCanvasWorkspaceStore.getState().syncMainCamera(ref)
    }
  }

  if (exitRaf) cancelAnimationFrame(exitRaf)
  exitRaf = requestAnimationFrame(loop)
}

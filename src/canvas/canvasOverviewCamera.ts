import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  CANVAS_MAX_SCALE,
  CANVAS_ZOOM_EDGE_PADDING,
  CANVAS_ZOOM_MIN_EDGE_PADDING,
  getCanvasHardMinScale,
  getCanvasOverviewScale,
} from '../drawing/canvasDimensions'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import type { SpaceCamera } from '../spaces/types'
import {
  isAtOverviewScale,
  overviewEnterScale,
  overviewExitScale,
} from './canvasOverviewThreshold'
import {
  cancelLibraryAnimation,
  readCameraFromRef,
  settleCanvasBounds,
  writeCameraTransform,
} from './canvasCamera'
import { useCanvasOverviewStore } from './canvasOverviewStore'
import {
  disableOverviewHyperMode,
} from './canvasOverviewHyperMode'
import { libraryCameraFromVirtual } from './canvasVirtualPan'
import { syncBackgroundMusicAcoustics } from '../sound/backgroundMusicAcoustics'
import {
  playOverviewEnterSound,
  playOverviewExitSound,
} from '../sound/overviewSound'
import {
  cancelPendingOverviewExitHandoff,
  flushPendingOverviewEnterHandoff,
} from './overviewLayoutHandoffFlush'

/** Combined zoom/map transition duration (ms). */
export const CANVAS_OVERVIEW_TRANSITION_MS = 560
const EXIT_MS = CANVAS_OVERVIEW_TRANSITION_MS
const ENTER_MS = EXIT_MS

let exitRaf = 0
let enterRaf = 0
let overviewTransitionGen = 0

function isOverviewTransitionStale(gen: number): boolean {
  return gen !== overviewTransitionGen
}

function cancelOverviewRafLoops(): void {
  if (exitRaf) {
    cancelAnimationFrame(exitRaf)
    exitRaf = 0
  }
  if (enterRaf) {
    cancelAnimationFrame(enterRaf)
    enterRaf = 0
  }
}

/** Cancel in-flight zoom loops and post-exit settle before the opposite transition. */
function beginOverviewTransition(
  ref: ReactZoomPanPinchContentRef | null,
): number {
  cancelOverviewRafLoops()
  if (ref) cancelLibraryAnimation(ref)
  useCanvasOverviewStore.getState().cancelExitSettling()
  overviewTransitionGen += 1
  return overviewTransitionGen
}

function isCanvasOverviewExiting(): boolean {
  return document.documentElement.hasAttribute('data-canvas-overview-exiting')
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

function setTransformZoomLimits(
  ref: ReactZoomPanPinchContentRef,
  minScale: number,
  maxScale: number,
): void {
  ref.instance.setup.minScale = minScale
  ref.instance.setup.maxScale = maxScale
}

function restoreNormalZoomLimits(
  ref: ReactZoomPanPinchContentRef,
  width: number,
  height: number,
): void {
  const hardMin = getCanvasHardMinScale(width, height)
  setTransformZoomLimits(
    ref,
    Math.max(hardMin - CANVAS_ZOOM_MIN_EDGE_PADDING, 0.05),
    CANVAS_MAX_SCALE + CANVAS_ZOOM_EDGE_PADDING,
  )
}

function lockOverviewZoomLimits(
  ref: ReactZoomPanPinchContentRef,
  width: number,
  height: number,
): void {
  const overviewScale = getCanvasOverviewScale(width, height)
  setTransformZoomLimits(ref, overviewScale, overviewScale)
}

function completeOverviewExitHandoff(
  ref: ReactZoomPanPinchContentRef,
  afterHandoff?: () => void,
): void {
  afterHandoff?.()
  const store = useCanvasOverviewStore.getState()
  store.setTransitioning(false)
  if (!store.exitSettling) {
    store.beginExitSettling()
  }
  settleCanvasBounds(ref)
}

/** Tap-to-exit overview: zoom in anchored at the tap. */
export function runCanvasOverviewExit(
  ref: ReactZoomPanPinchContentRef | null,
  anchor: { x: number; y: number } | null,
): void {
  if (!ref) return
  const wrapper = ref.instance?.wrapperComponent
  const scale = ref.state?.scale
  if (!wrapper || !Number.isFinite(scale)) return

  const gen = beginOverviewTransition(ref)
  const store = useCanvasOverviewStore.getState()
  if (store.layoutHandoff?.mode === 'enter') {
    flushPendingOverviewEnterHandoff(ref)
  }
  cancelPendingOverviewExitHandoff()

  document.documentElement.setAttribute('data-canvas-overview-exiting', '')
  store.setTransitioning(true)
  syncBackgroundMusicAcoustics()
  playOverviewExitSound()

  const width = wrapper.offsetWidth
  const height = wrapper.offsetHeight
  const startScale = scale
  const toScale = overviewExitScale(width, height)
  const overviewScale = getCanvasOverviewScale(width, height)
  setTransformZoomLimits(ref, overviewScale, toScale)

  const startX = ref.state.positionX
  const startY = ref.state.positionY
  const rect = wrapper.getBoundingClientRect()
  const ax = anchor ? anchor.x - rect.left : width / 2
  const ay = anchor ? anchor.y - rect.top : height / 2
  const canvasAx = (ax - startX) / startScale
  const canvasAy = (ay - startY) / startScale
  const start = performance.now()

  const loop = (now: number) => {
    if (isOverviewTransitionStale(gen)) return
    const t = Math.min(1, (now - start) / EXIT_MS)
    const easeZoom = 1 - (1 - t) ** 3
    const s = startScale + (toScale - startScale) * easeZoom
    ref.setTransform(ax - canvasAx * s, ay - canvasAy * s, s, 0)
    if (t < 1) {
      exitRaf = requestAnimationFrame(loop)
    } else {
      exitRaf = 0
      if (isOverviewTransitionStale(gen)) return
      restoreNormalZoomLimits(ref, width, height)
      disableOverviewHyperMode(ref, () => {
        if (isOverviewTransitionStale(gen)) return
        completeOverviewExitHandoff(ref)
      })
    }
  }

  exitRaf = requestAnimationFrame(loop)
}

/** Zoom out into overview from normal zoom. */
export function runCanvasOverviewEnter(
  ref: ReactZoomPanPinchContentRef | null,
  anchor: { x: number; y: number } | null,
): void {
  if (!ref) return
  const wrapper = ref.instance?.wrapperComponent
  const scale = ref.state?.scale
  if (!wrapper || !Number.isFinite(scale)) return

  const gen = beginOverviewTransition(ref)
  cancelPendingOverviewExitHandoff()
  document.documentElement.removeAttribute('data-canvas-overview-exiting')
  playOverviewEnterSound()

  const width = wrapper.offsetWidth
  const height = wrapper.offsetHeight
  const toScale = overviewEnterScale(width, height)

  const startEnterAnimation = () => {
    if (isOverviewTransitionStale(gen)) return
    const liveScale = ref.state.scale
    if (!Number.isFinite(liveScale)) return

    setTransformZoomLimits(
      ref,
      toScale,
      CANVAS_MAX_SCALE + CANVAS_ZOOM_EDGE_PADDING,
    )

    if (isAtOverviewScale(liveScale, width, height)) {
      lockOverviewZoomLimits(ref, width, height)
      useCanvasOverviewStore.getState().setTransitioning(false)
      settleCanvasBounds(ref)
      return
    }
    const startScale = liveScale
    const startX = ref.state.positionX
    const startY = ref.state.positionY
    const rect = wrapper.getBoundingClientRect()
    const ax = anchor ? anchor.x - rect.left : width / 2
    const ay = anchor ? anchor.y - rect.top : height / 2
    const canvasAx = (ax - startX) / startScale
    const canvasAy = (ay - startY) / startScale
    const start = performance.now()

    const loop = (now: number) => {
      if (isOverviewTransitionStale(gen)) return
      const t = Math.min(1, (now - start) / ENTER_MS)
      const easeZoom = 1 - (1 - t) ** 3
      const s = startScale + (toScale - startScale) * easeZoom
      ref.setTransform(ax - canvasAx * s, ay - canvasAy * s, s, 0)
      if (t < 1) {
        enterRaf = requestAnimationFrame(loop)
      } else {
        enterRaf = 0
        if (isOverviewTransitionStale(gen)) return
        lockOverviewZoomLimits(ref, width, height)
        useCanvasOverviewStore.getState().setTransitioning(false)
        settleCanvasBounds(ref)
      }
    }

    enterRaf = requestAnimationFrame(loop)
  }

  const virtual = readCameraFromRef(ref)
  const store = useCanvasOverviewStore.getState()
  if (virtual) {
    store.beginOverviewEnter(
      {
        mode: 'enter',
        virtual,
        onComplete: () => {
          if (isOverviewTransitionStale(gen)) return
          startEnterAnimation()
        },
      },
      true,
    )
  } else {
    store.beginOverviewEnter(null, true)
    startEnterAnimation()
  }
}

/** Toggle canvas overview — zoom out/in and flip overview UI. */
export function toggleCanvasOverview(
  ref: ReactZoomPanPinchContentRef | null,
  anchor: { x: number; y: number } | null = null,
): void {
  const { engaged, exitSettling } = useCanvasOverviewStore.getState()
  const leaving =
    engaged && !exitSettling && !isCanvasOverviewExiting()
  if (leaving) {
    runCanvasOverviewExit(ref, anchor)
  } else {
    runCanvasOverviewEnter(ref, anchor)
  }
}

/**
 * Leave overview while animating back to an exact saved camera, used when
 * dismissing the canvas map opened via shortcut from standard zoom.
 */
export function runCanvasOverviewExitToCamera(
  ref: ReactZoomPanPinchContentRef | null,
  target: SpaceCamera,
): void {
  if (!ref) return
  const wrapper = ref.instance?.wrapperComponent
  const scale = ref.state?.scale
  if (!wrapper || !Number.isFinite(scale)) return

  const gen = beginOverviewTransition(ref)
  const store = useCanvasOverviewStore.getState()
  if (store.layoutHandoff?.mode === 'enter') {
    flushPendingOverviewEnterHandoff(ref)
  }
  cancelPendingOverviewExitHandoff()

  document.documentElement.setAttribute('data-canvas-overview-exiting', '')
  store.setTransitioning(true)
  syncBackgroundMusicAcoustics()
  playOverviewExitSound()

  const width = wrapper.offsetWidth
  const height = wrapper.offsetHeight
  const hardMin = getCanvasHardMinScale(width, height)
  const overviewScale = getCanvasOverviewScale(width, height)
  const startScale = scale
  const toScale = Math.min(
    CANVAS_MAX_SCALE,
    Math.max(hardMin, target.scale),
  )
  setTransformZoomLimits(ref, overviewScale, Math.max(toScale, startScale))

  const startX = ref.state.positionX
  const startY = ref.state.positionY
  const libraryTarget = libraryCameraFromVirtual(target)
  const toX = libraryTarget.positionX
  const toY = libraryTarget.positionY
  const start = performance.now()

  const loop = (now: number) => {
    if (isOverviewTransitionStale(gen)) return
    const t = Math.min(1, (now - start) / EXIT_MS)
    const easeZoom = 1 - (1 - t) ** 3
    const s = startScale + (toScale - startScale) * easeZoom
    const x = startX + (toX - startX) * easeZoom
    const y = startY + (toY - startY) * easeZoom
    ref.setTransform(x, y, s, 0)
    if (t < 1) {
      exitRaf = requestAnimationFrame(loop)
    } else {
      exitRaf = 0
      if (isOverviewTransitionStale(gen)) return
      restoreNormalZoomLimits(ref, width, height)
      disableOverviewHyperMode(ref, () => {
        if (isOverviewTransitionStale(gen)) return
        completeOverviewExitHandoff(ref, () => {
          writeCameraTransform(ref, target.positionX, target.positionY, toScale, 0)
          useCanvasWorkspaceStore.getState().syncMainCamera(ref)
        })
      })
    }
  }

  exitRaf = requestAnimationFrame(loop)
}

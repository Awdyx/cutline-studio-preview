import { useEffect, useRef, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { readCameraFromRef, writeCameraTransform } from './canvasCamera'
import { isTouchFirstDevice } from '../platform/compositor'
import { usePanMotionStore } from '../panMotionStore'
import { holdMeshPauseSync } from './useCanvasMeshPause'
const PANNING_ATTR_HOLD_MS = 48
const PANNING_ATTR_STUCK_CLEAR_MS = 180
const CANVAS_FROST_SELECTOR = '.ui-space-glass'

function nudgeBackdropFilterOnNodes(root: ParentNode, selector: string): void {
  root.querySelectorAll(selector).forEach((node) => {
    if (!(node instanceof HTMLElement)) return
    node.style.setProperty('-webkit-backdrop-filter', 'none')
    node.style.setProperty('backdrop-filter', 'none')
    void node.offsetHeight
    node.style.removeProperty('-webkit-backdrop-filter')
    node.style.removeProperty('backdrop-filter')
  })
}

const OVERVIEW_EXIT_COMPOSITOR_SELECTOR =
  '[data-canvas-item="study_hub"], [data-canvas-item="image"]'

/** Force eager layout on compositor-heavy canvas items after overview exit. */
export function refreshOverviewExitCompositorItems(
  root: HTMLElement | null | undefined,
): void {
  if (!root) return
  root.querySelectorAll(OVERVIEW_EXIT_COMPOSITOR_SELECTOR).forEach((node) => {
    if (!(node instanceof HTMLElement)) return
    node.style.setProperty('content-visibility', 'visible')
    void node.offsetHeight
    node.style.removeProperty('content-visibility')
  })
}

export function refreshCanvasFrostedSurfaces(root: HTMLElement | null | undefined): void {
  if (!root || isTouchFirstDevice()) return
  nudgeBackdropFilterOnNodes(root, CANVAS_FROST_SELECTOR)
}

export function resolveCanvasTransformLayer(
  anchor: HTMLElement | null | undefined,
): HTMLElement | null {
  if (!anchor) return null
  return anchor.closest('.react-transform-component') as HTMLElement | null
}

function isCanvasGesturing(): boolean {
  const s = usePanMotionStore.getState()
  return s.zoomActive || s.canvasPanActive
}

/**
 * Imperceptible scale wiggle + matrix rewrite — forces WebKit to repaint vectors
 * at the settled zoom level without clearing the transform (no flash).
 */
export function flushCanvasTransformLayer(
  layer: HTMLElement,
  transformRef?: ReactZoomPanPinchContentRef | null,
): void {
  if (isTouchFirstDevice()) return
  if (!transformRef) return

  const camera = readCameraFromRef(transformRef)
  if (!camera) return

  layer.style.willChange = 'auto'
  writeCameraTransform(
    transformRef,
    camera.positionX,
    camera.positionY,
    camera.scale * 1.000001,
    0,
  )
  void layer.offsetHeight

  requestAnimationFrame(() => {
    const settled = readCameraFromRef(transformRef) ?? camera
    writeCameraTransform(
      transformRef,
      settled.positionX,
      settled.positionY,
      settled.scale,
      0,
    )
    void layer.offsetHeight
    refreshCanvasFrostedSurfaces(layer)
    requestAnimationFrame(() => {
      layer.style.willChange = ''
    })
  })
}

export function scheduleCanvasTransformLayerFlush(
  anchor: HTMLElement | null | undefined,
  transformRef?: ReactZoomPanPinchContentRef | null,
): void {
  if (isTouchFirstDevice()) return
  const layer = resolveCanvasTransformLayer(anchor)
  if (!layer || !transformRef) return

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      flushCanvasTransformLayer(layer, transformRef)
    })
  })
}

export function useCanvasCompositorWarmup(
  canvasRef: RefObject<HTMLDivElement | null>,
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  ready: boolean,
) {
  const doneRef = useRef(false)

  useEffect(() => {
    if (isTouchFirstDevice()) return
    if (!ready || doneRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return

    const layer = resolveCanvasTransformLayer(canvas)
    if (!layer) return

    doneRef.current = true
    flushCanvasTransformLayer(layer, transformRef.current)
  }, [ready, canvasRef, transformRef])
}

/**
 * Keeps data-canvas-panning through a short post-gesture hold so the compositor
 * flush runs under the same path as active zoom, then drops back to idle CSS.
 */
export function useCanvasGestureCompositor(
  canvasRef: RefObject<HTMLDivElement | null>,
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
) {
  const panningClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const panningStuckClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const meshPauseReleaseRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const root = document.documentElement

    const releaseMeshPause = () => {
      meshPauseReleaseRef.current?.()
      meshPauseReleaseRef.current = null
    }

    const clearPanningAttr = () => {
      if (panningClearRef.current != null) {
        clearTimeout(panningClearRef.current)
        panningClearRef.current = null
      }
      if (panningStuckClearRef.current != null) {
        clearTimeout(panningStuckClearRef.current)
        panningStuckClearRef.current = null
      }
      root.removeAttribute('data-canvas-panning')
      root.removeAttribute('data-canvas-trackpad-pan-lock')
      if (!isOverviewHyperPanActive()) {
        refreshCanvasFrostedSurfaces(canvasRef.current)
      }
    }

    const schedulePanningAttrClear = () => {
      if (panningClearRef.current != null) clearTimeout(panningClearRef.current)
      panningClearRef.current = setTimeout(() => {
        panningClearRef.current = null
        if (isCanvasGesturing()) return
        clearPanningAttr()
      }, PANNING_ATTR_HOLD_MS)
    }

    const scheduleStuckPanningAttrClear = () => {
      if (panningStuckClearRef.current != null) clearTimeout(panningStuckClearRef.current)
      panningStuckClearRef.current = setTimeout(() => {
        panningStuckClearRef.current = null
        if (!root.hasAttribute('data-canvas-panning')) return
        if (isCanvasGesturing()) {
          usePanMotionStore.getState().setCanvasPanActive(false)
        }
        if (isCanvasGesturing()) return
        clearPanningAttr()
      }, PANNING_ATTR_STUCK_CLEAR_MS)
    }

    const syncPanningAttr = () => {
      const { canvasPanActive } = usePanMotionStore.getState()
      if (canvasPanActive) {
        root.setAttribute('data-canvas-trackpad-pan-lock', '')
      } else {
        root.removeAttribute('data-canvas-trackpad-pan-lock')
      }

      if (isCanvasGesturing()) {
        if (!meshPauseReleaseRef.current) {
          meshPauseReleaseRef.current = holdMeshPauseSync()
        }
        if (panningClearRef.current != null) {
          clearTimeout(panningClearRef.current)
          panningClearRef.current = null
        }
        if (panningStuckClearRef.current != null) {
          clearTimeout(panningStuckClearRef.current)
          panningStuckClearRef.current = null
        }
        root.setAttribute('data-canvas-panning', '')
        return
      }

      releaseMeshPause()

      if (!root.hasAttribute('data-canvas-panning')) return

      scheduleCanvasTransformLayerFlush(canvasRef.current, transformRef.current)
      schedulePanningAttrClear()
      scheduleStuckPanningAttrClear()
    }

    syncPanningAttr()
    return usePanMotionStore.subscribe(syncPanningAttr)
  }, [canvasRef, transformRef])

  useEffect(
    () => () => {
      if (panningClearRef.current != null) clearTimeout(panningClearRef.current)
      if (panningStuckClearRef.current != null) clearTimeout(panningStuckClearRef.current)
      meshPauseReleaseRef.current?.()
      meshPauseReleaseRef.current = null
    },
    [],
  )
}

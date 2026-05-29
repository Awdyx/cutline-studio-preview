import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { refitCameraAfterResize } from './canvasCamera'
import { getCanvasMinScale } from '../drawing/canvasDimensions'
import { readViewportSize, type ViewportSize } from '../platform/viewportSize'
import {
  ensureNotInFisheyeOverview,
  updateCanvasBarrelAfterCamera,
} from './canvasBarrelPostProcess'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'

export type { ViewportSize }

function initialViewportSize(): ViewportSize {
  return readViewportSize() ?? { width: window.innerWidth, height: window.innerHeight }
}

/**
 * Screen pixel size for the pan/zoom wrapper + single camera-apply gate
 * (transform mounted and workspace hydrated).
 */
export function useCanvasViewport(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [viewportSize, setViewportSize] = useState(initialViewportSize)
  const [minScale, setMinScale] = useState(() => {
    const size = initialViewportSize()
    return getCanvasMinScale(size.width, size.height)
  })
  const transformReadyRef = useRef(false)
  const hydratedRef = useRef(false)

  const refreshMinScale = useCallback(
    (width: number, height: number) => {
      setMinScale(getCanvasMinScale(width, height))
    },
    [],
  )

  const applyCamera = useCallback(() => {
    const ref = transformRef.current
    const viewport = viewportRef.current
    if (!ref || !viewport) return

    const size = readViewportSize(viewport)
    if (!size) return

    refreshMinScale(size.width, size.height)

    // Wait until the wrapper has picked up the pixel dimensions from wrapperStyle.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const live = transformRef.current
        if (!live) return
        useCanvasWorkspaceStore.getState().applyCameraForActiveCanvas(live)
        const nextMin = refitCameraAfterResize(live)
        if (nextMin != null) setMinScale(nextMin)
        ensureNotInFisheyeOverview(live)
        updateCanvasBarrelAfterCamera(live, { silent: true })
      })
    })
  }, [transformRef, refreshMinScale])

  const tryApplyCamera = useCallback(() => {
    if (!transformReadyRef.current || !hydratedRef.current) return
    applyCamera()
  }, [applyCamera])

  const onTransformInit = useCallback(
    (_ref: ReactZoomPanPinchContentRef) => {
      transformReadyRef.current = true
      tryApplyCamera()
    },
    [tryApplyCamera],
  )

  const onHydrated = useCallback(() => {
    hydratedRef.current = true
    tryApplyCamera()
  }, [tryApplyCamera])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    let rafId = 0

    const measure = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const size = readViewportSize(el)
        if (!size) return

        setViewportSize(size)
        refreshMinScale(size.width, size.height)

        const ref = transformRef.current
        if (ref && transformReadyRef.current && hydratedRef.current) {
          requestAnimationFrame(() => {
            const live = transformRef.current
            if (!live) return
            const nextMin = refitCameraAfterResize(live)
            if (nextMin != null) setMinScale(nextMin)
            ensureNotInFisheyeOverview(live)
            useCanvasWorkspaceStore.getState().syncMainCamera(live)
            updateCanvasBarrelAfterCamera(live, { silent: true })
          })
        }
      })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)

    const vv = window.visualViewport
    vv?.addEventListener('resize', measure)
    vv?.addEventListener('scroll', measure)
    window.addEventListener('orientationchange', measure)
    window.addEventListener('resize', measure)

    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
      vv?.removeEventListener('resize', measure)
      vv?.removeEventListener('scroll', measure)
      window.removeEventListener('orientationchange', measure)
      window.removeEventListener('resize', measure)
    }
  }, [transformRef, refreshMinScale])

  return {
    viewportRef,
    viewportSize,
    minScale,
    onTransformInit,
    onHydrated,
  }
}

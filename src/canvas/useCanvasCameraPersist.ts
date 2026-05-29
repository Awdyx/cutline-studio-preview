import { useCallback, useEffect, useRef, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'

/**
 * Keeps persisted main-camera in sync with live pan/zoom:
 * - RAF-throttled updates while the camera moves
 * - immediate flush on gesture end and page hide
 */
export function useCanvasCameraPersist(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
) {
  const rafRef = useRef<number | null>(null)

  const syncCameraNow = useCallback(
    (ref?: ReactZoomPanPinchContentRef | null) => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      const live = ref ?? transformRef.current
      if (live) useCanvasWorkspaceStore.getState().syncMainCamera(live)
    },
    [transformRef],
  )

  const scheduleCameraSync = useCallback((ref: ReactZoomPanPinchContentRef) => {
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      useCanvasWorkspaceStore.getState().syncMainCamera(ref)
    })
  }, [])

  const syncAndFlushCamera = useCallback(
    (ref?: ReactZoomPanPinchContentRef | null) => {
      syncCameraNow(ref)
      useCanvasWorkspaceStore.getState().flushPersistWorkspace()
    },
    [syncCameraNow],
  )

  useEffect(() => {
    const onHide = () => syncAndFlushCamera()
    window.addEventListener('pagehide', onHide)
    window.addEventListener('beforeunload', onHide)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') syncAndFlushCamera()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('pagehide', onHide)
      window.removeEventListener('beforeunload', onHide)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [syncAndFlushCamera])

  return { scheduleCameraSync, syncCameraNow, syncAndFlushCamera }
}

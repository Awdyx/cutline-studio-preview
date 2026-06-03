import { useEffect, useRef, type RefObject } from 'react'
import { useCanvasLockFlattenStore } from '../canvasLock/canvasLockFlattenStore'
import { effectiveCanvasLocked } from '../canvasLock/layer'
import { useCanvasLockStore } from '../canvasLock/canvasLockStore'
import { shouldFlattenCanvas } from '../canvasLock/flattenVisibility'
import { usePanMotionStore } from '../panMotionStore'
import { useLassoStore } from './useLassoStore'
import { useStrokesStore } from './strokesStore'
import { useThemeStore } from '../theme/themeStore'
import { captureStrokeSvgBitmaps } from './captureStrokeSvgs'
import { readStrokeRasterFingerprint } from './strokeRasterFingerprint'
import { useStrokeRasterStore } from './strokeRasterStore'

const PAN_RASTER_HOLD_MS = 48
const MIN_STROKES_FOR_RASTER = 1

function shouldSkipStrokeRaster(): boolean {
  const lockActive = effectiveCanvasLocked(useCanvasLockStore.getState().isLocked)
  const flattenReady = useCanvasLockFlattenStore.getState().ready
  if (shouldFlattenCanvas(lockActive) && flattenReady) return true

  const { strokes, annotationStrokes } = useStrokesStore.getState()
  if (strokes.length + annotationStrokes.length < MIN_STROKES_FOR_RASTER) return true

  if (useLassoStore.getState().dragOffset != null) return true

  return false
}

function scheduleIdle(fn: () => void): () => void {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(fn, { timeout: 800 })
    return () => cancelIdleCallback(id)
  }
  const timer = window.setTimeout(fn, 32)
  return () => clearTimeout(timer)
}

/**
 * Pre-rasterize committed stroke SVG layers while idle; swap to bitmaps during pan/zoom.
 */
export function useStrokeRaster(
  canvasRef: RefObject<HTMLDivElement | null>,
  canvasMount: HTMLDivElement | null,
) {
  const panClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rebuildCancelRef = useRef<(() => void) | null>(null)
  const captureGenRef = useRef(0)

  useEffect(() => {
    const root = canvasMount ?? canvasRef.current
    if (!root) return

    const rebuildCache = async () => {
      if (shouldSkipStrokeRaster()) {
        useStrokeRasterStore.getState().clear()
        return
      }

      const fingerprint = readStrokeRasterFingerprint()
      const store = useStrokeRasterStore.getState()
      if (store.cacheFingerprint === fingerprint && Object.keys(store.bitmapsByKey).length > 0) {
        return
      }

      const gen = ++captureGenRef.current
      store.setRebuilding(true)

      const bitmapsByKey = await captureStrokeSvgBitmaps(root)
      if (gen !== captureGenRef.current) return
      if (Object.keys(bitmapsByKey).length === 0) {
        store.clear()
        return
      }

      store.setCache(fingerprint, bitmapsByKey)
    }

    const queueRebuild = () => {
      rebuildCancelRef.current?.()
      rebuildCancelRef.current = scheduleIdle(() => {
        rebuildCancelRef.current = null
        void rebuildCache()
      })
    }

    const clearPanRaster = () => {
      if (panClearRef.current != null) {
        clearTimeout(panClearRef.current)
        panClearRef.current = null
      }
      useStrokeRasterStore.getState().setDisplayRaster(false)
    }

    const schedulePanRasterClear = () => {
      if (panClearRef.current != null) clearTimeout(panClearRef.current)
      panClearRef.current = setTimeout(() => {
        panClearRef.current = null
        const motion = usePanMotionStore.getState()
        if (motion.zoomActive || motion.canvasPanActive) return
        clearPanRaster()
      }, PAN_RASTER_HOLD_MS)
    }

    const tryShowPanRaster = () => {
      if (shouldSkipStrokeRaster()) {
        clearPanRaster()
        return
      }

      const store = useStrokeRasterStore.getState()
      const fingerprint = readStrokeRasterFingerprint()

      if (store.cacheFingerprint !== fingerprint || Object.keys(store.bitmapsByKey).length === 0) {
        void rebuildCache().then(() => {
          const next = useStrokeRasterStore.getState()
          if (Object.keys(next.bitmapsByKey).length === 0) return
          if (!usePanMotionStore.getState().zoomActive && !usePanMotionStore.getState().canvasPanActive) {
            return
          }
          next.setDisplayRaster(true)
        })
        return
      }

      store.setDisplayRaster(true)
    }

    const syncPanRaster = () => {
      const motion = usePanMotionStore.getState()
      const gesturing = motion.zoomActive || motion.canvasPanActive

      if (gesturing) {
        if (panClearRef.current != null) {
          clearTimeout(panClearRef.current)
          panClearRef.current = null
        }
        tryShowPanRaster()
        return
      }

      if (!useStrokeRasterStore.getState().displayRaster) return
      schedulePanRasterClear()
    }

    queueRebuild()

    const unsubPan = usePanMotionStore.subscribe(syncPanRaster)
    const unsubStrokes = useStrokesStore.subscribe(queueRebuild)
    const unsubTheme = useThemeStore.subscribe(queueRebuild)
    const unsubLasso = useLassoStore.subscribe((state) => {
      if (state.dragOffset != null) clearPanRaster()
      queueRebuild()
    })

    syncPanRaster()

    return () => {
      captureGenRef.current += 1
      rebuildCancelRef.current?.()
      rebuildCancelRef.current = null
      if (panClearRef.current != null) clearTimeout(panClearRef.current)
      unsubPan()
      unsubStrokes()
      unsubTheme()
      unsubLasso()
      useStrokeRasterStore.getState().clear()
    }
  }, [canvasRef, canvasMount])
}

import { useEffect, useRef, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { refitAppDestinationFocusPlate } from '../navigation/appDestinationFocus'
import { syncFeaturePlateDimensionCssVars } from './canvasPlate'
import {
  readFeaturePlateViewportSize,
  featurePlateDimensionsForViewport,
} from './featurePlateViewportDimensions'
import { useFeaturePlateViewportStore } from './featurePlateViewportStore'
import { useAppDestinationFocusStore } from '../navigation/appDestinationFocusStore'

/** Keep feature plates viewport-shaped on the canvas; refit if a space is focused. */
export function useFeaturePlateViewportSync(
  viewportRef: RefObject<HTMLDivElement | null>,
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
): void {
  const activeDestination = useAppDestinationFocusStore((s) =>
    s.panLocked && s.focusRevealed && !s.dismissing ? s.activeDestination : null,
  )
  const liveRef = useRef(false)

  useEffect(() => {
    const el = document.documentElement
    if (!activeDestination) {
      el.removeAttribute('data-app-destination-focus-reveal')
      el.removeAttribute('data-app-destination-focus')
      return
    }

    el.setAttribute('data-app-destination-focus', activeDestination)
    const raf = requestAnimationFrame(() => {
      el.setAttribute('data-app-destination-focus-reveal', '')
    })

    return () => {
      cancelAnimationFrame(raf)
      el.removeAttribute('data-app-destination-focus-reveal')
      el.removeAttribute('data-app-destination-focus')
    }
  }, [activeDestination])

  useEffect(() => {
    const host = viewportRef.current
    if (!host) return

    let rafId = 0

    const measure = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const size = readFeaturePlateViewportSize(host)
        const prev = useFeaturePlateViewportStore.getState().dimensions
        const next = featurePlateDimensionsForViewport(
          size.width,
          size.height,
          prev,
        )
        if (!next) return

        // Update store + CSS vars. Don't reflow positions — plates reshape
        // from their origin. Moving them on every resize causes visual jumping.
        useFeaturePlateViewportStore.getState().syncFromViewport(size.width, size.height)
        syncFeaturePlateDimensionCssVars(next)

        if (!liveRef.current) {
          liveRef.current = true
          document.documentElement.setAttribute('data-feature-plate-aspect-live', '')
        }

        const focus = useAppDestinationFocusStore.getState()
        if (focus.panLocked && focus.focusRevealed) {
          refitAppDestinationFocusPlate(transformRef)
        }
      })
    }

    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(host)
    window.addEventListener('resize', measure)

    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [viewportRef, transformRef])
}

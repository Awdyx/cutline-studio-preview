import { useCallback, useEffect, useState, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { usePanMotionStore } from '../panMotionStore'
import {
  canvasRectToRegionPercent,
  readCanvasMinimapViewport,
  type CanvasMinimapPercentRect,
  type CanvasMinimapRect,
} from './canvasMinimapGeometry'
import { useCanvasMinimapStore } from './canvasMinimapStore'

function minimapRectsEqual(
  a: CanvasMinimapRect | null,
  b: CanvasMinimapRect | null,
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
  )
}

export function applyCollapsedMinimapViewportPct(
  el: HTMLElement,
  pct: CanvasMinimapPercentRect,
): void {
  el.style.left = `${pct.left}%`
  el.style.top = `${pct.top}%`
  el.style.width = `${Math.max(pct.width, 5)}%`
  el.style.height = `${Math.max(pct.height, 5)}%`
}

type MinimapViewportOptions = {
  collapsedViewportElRef?: RefObject<HTMLElement | null>
  mapRegion?: CanvasMinimapRect | null
}

/** Live viewport rect on the full canvas while navigation minimap is shown. */
export function useCanvasMinimapViewport(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  viewportRef: RefObject<HTMLElement | null>,
  active: boolean,
  options?: MinimapViewportOptions,
): CanvasMinimapRect | null {
  const [viewport, setViewport] = useState<CanvasMinimapRect | null>(null)
  const collapsedViewportElRef = options?.collapsedViewportElRef
  const mapRegion = options?.mapRegion ?? null

  const readNext = useCallback((): CanvasMinimapRect | null => {
    const ref = transformRef.current
    const wrapper =
      viewportRef.current ?? ref?.instance.wrapperComponent ?? null
    const width = wrapper?.clientWidth ?? 0
    const height = wrapper?.clientHeight ?? 0
    return readCanvasMinimapViewport(ref, width, height)
  }, [transformRef, viewportRef])

  const syncViewport = useCallback(
    (commitReact: boolean) => {
      const next = readNext()
      if (!next) return

      const expandedOpen = useCanvasMinimapStore.getState().expandedOpen
      if (
        !commitReact &&
        !expandedOpen &&
        collapsedViewportElRef?.current &&
        mapRegion
      ) {
        applyCollapsedMinimapViewportPct(
          collapsedViewportElRef.current,
          canvasRectToRegionPercent(next, mapRegion),
        )
        return
      }

      setViewport((prev) => (minimapRectsEqual(prev, next) ? prev : next))
    },
    [readNext, collapsedViewportElRef, mapRegion],
  )

  useEffect(() => {
    if (!active) {
      setViewport(null)
      return
    }

    syncViewport(true)

    let panRaf = 0
    let panLoopActive = false
    let wasPanActive = usePanMotionStore.getState().canvasPanActive

    const runPanLoop = () => {
      if (!panLoopActive) return
      syncViewport(false)
      panRaf = requestAnimationFrame(runPanLoop)
    }

    const unsub = usePanMotionStore.subscribe((state) => {
      const panActive = state.canvasPanActive
      if (panActive && !wasPanActive) {
        panLoopActive = true
        cancelAnimationFrame(panRaf)
        panRaf = requestAnimationFrame(runPanLoop)
      } else if (!panActive && wasPanActive) {
        panLoopActive = false
        cancelAnimationFrame(panRaf)
        syncViewport(true)
      }
      wasPanActive = panActive
    })

    const onResize = () => syncViewport(true)
    window.addEventListener('resize', onResize)

    return () => {
      unsub()
      panLoopActive = false
      cancelAnimationFrame(panRaf)
      window.removeEventListener('resize', onResize)
    }
  }, [active, syncViewport])

  return viewport
}

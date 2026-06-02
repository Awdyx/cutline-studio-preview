import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { useCanvasOverviewStore } from './canvasOverviewStore'
import {
  canvasMinimapMapRegion,
  canvasMinimapStudioRect,
  canvasRectToRegionPercent,
  readCanvasMinimapViewport,
  type CanvasMinimapPercentRect,
  type CanvasMinimapRect,
} from './canvasMinimapGeometry'
import { useCanvasMinimapViewport } from './useCanvasMinimapViewport'
import { useCanvasMinimapViewportSquish } from './useCanvasMinimapViewportSquish'
import { minimapViewportSquishTransform } from './canvasMinimapViewportSquish'
import { useStudioCentrePositionStore } from './studioCentrePositionStore'
import CanvasMinimapExpandedMenu from './CanvasMinimapExpandedMenu'
import { closeCanvasMinimap, expandCanvasMinimap } from './canvasMinimapOpen'
import { useCanvasMinimapStore } from './canvasMinimapStore'
import { CANVAS_ASPECT } from '../drawing/canvasDimensions'
import { useAppDestinationActive } from '../navigation/useAppDestinationActive'
import { playSubmenuTap } from '../sound/submenuSound'
const MINIMAP_WIDTH_PX = 124

function readLiveMinimapViewport(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  viewportRef: RefObject<HTMLElement | null>,
): CanvasMinimapRect | null {
  const ref = transformRef.current
  const wrapper = viewportRef.current ?? ref?.instance.wrapperComponent ?? null
  if (!wrapper) return null
  return readCanvasMinimapViewport(ref, wrapper.clientWidth, wrapper.clientHeight)
}

function CollapsedMinimapDestination({
  pct,
  word,
  suffix,
}: {
  pct: CanvasMinimapPercentRect
  word: string
  suffix: string
}) {
  const selected = useAppDestinationActive('studio')

  return (
    <>
      <div
        className={`canvas-nav-minimap__plate${
          selected ? ' canvas-nav-minimap__plate--selected' : ''
        }`}
        aria-hidden
        style={{
          left: `${pct.left}%`,
          top: `${pct.top}%`,
          width: `${pct.width}%`,
          height: `${pct.height}%`,
        }}
      />
      <p
        className={`canvas-nav-minimap__plate-label${
          selected ? ' canvas-nav-minimap__plate-label--selected' : ''
        }`}
        aria-hidden
        style={{
          left: `${pct.left}%`,
          top: `${pct.top}%`,
        }}
      >
        <span className="canvas-nav-minimap__plate-label-word">{word}</span>
        <span className="canvas-nav-minimap__plate-label-suffix">{suffix}</span>
      </p>
    </>
  )
}

type Props = {
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  viewportRef: RefObject<HTMLElement | null>
}

export default function CanvasNavigationMinimap({
  transformRef,
  viewportRef,
}: Props) {
  const engaged = useCanvasOverviewStore((s) => s.engaged)
  const reduceMotion = useReducedMotion()
  const expandedOpen = useCanvasMinimapStore((s) => s.expandedOpen)
  const setExpandedOpen = useCallback((open: boolean) => {
    useCanvasMinimapStore.getState().setExpandedOpen(open)
  }, [])
  const studioX = useStudioCentrePositionStore((s) => s.x)
  const studioY = useStudioCentrePositionStore((s) => s.y)
  const collapsedViewportRef = useRef<HTMLDivElement | null>(null)
  const mapRegion = useMemo(() => canvasMinimapMapRegion(), [])
  const viewport = useCanvasMinimapViewport(transformRef, viewportRef, engaged, {
    collapsedViewportElRef: collapsedViewportRef,
    mapRegion,
  })
  const lastViewportRef = useRef<CanvasMinimapRect | null>(null)
  const displayViewport = useMemo(() => {
    const next = viewport ?? readLiveMinimapViewport(transformRef, viewportRef)
    if (next) {
      lastViewportRef.current = next
      return next
    }
    return lastViewportRef.current
  }, [viewport, transformRef, viewportRef, engaged])
  const viewportSquish = useCanvasMinimapViewportSquish(
    engaged && !expandedOpen,
    reduceMotion,
    transformRef,
  )

  useEffect(() => {
    if (!engaged) {
      const minimap = useCanvasMinimapStore.getState()
      minimap.setRepositionHintOpen(false)
      setExpandedOpen(false)
    }
  }, [engaged, setExpandedOpen])

  const viewportPct = useMemo(
    () =>
      displayViewport ? canvasRectToRegionPercent(displayViewport, mapRegion) : null,
    [displayViewport, mapRegion],
  )

  const studioPct = useMemo(
    () => canvasRectToRegionPercent(canvasMinimapStudioRect(), mapRegion),
    [studioX, studioY, mapRegion],
  )

  const frameHeight = MINIMAP_WIDTH_PX / CANVAS_ASPECT
  const lastViewportPctRef = useRef<CanvasMinimapPercentRect | null>(null)
  if (viewportPct) lastViewportPctRef.current = viewportPct
  const displayViewportPct = viewportPct ?? lastViewportPctRef.current

  return (
    <>
      <div className="canvas-nav-minimap">
        <button
          type="button"
          className="canvas-nav-minimap__preview"
          aria-label="Open canvas map"
          aria-hidden={!engaged || expandedOpen}
          tabIndex={engaged && !expandedOpen ? 0 : -1}
          onClick={() => {
            playSubmenuTap()
            expandCanvasMinimap()
          }}
        >
          <span className="canvas-nav-minimap__halo" aria-hidden />
          <div
            className="canvas-nav-minimap__frame"
            style={{ width: MINIMAP_WIDTH_PX, height: frameHeight }}
          >
            <div className="canvas-nav-minimap__surface" aria-hidden>
              <div className="canvas-nav-minimap__void" />
              <div className="canvas-nav-minimap__grid" />
              <div className="canvas-nav-minimap__vignette" />
            </div>

            <CollapsedMinimapDestination
              pct={studioPct}
              word="studio"
              suffix="<3"
            />

            {displayViewportPct && (
              <div
                ref={collapsedViewportRef}
                className="canvas-nav-minimap__viewport"
                style={{
                  left: `${displayViewportPct.left}%`,
                  top: `${displayViewportPct.top}%`,
                  width: `${Math.max(displayViewportPct.width, 5)}%`,
                  height: `${Math.max(displayViewportPct.height, 5)}%`,
                }}
              >
                <div
                  className="canvas-nav-minimap__viewport-squish"
                  style={{
                    transform: minimapViewportSquishTransform(viewportSquish),
                    transformOrigin: `${viewportSquish.originX}% ${viewportSquish.originY}%`,
                  }}
                >
                  <div
                    className="canvas-nav-minimap__viewport-corners"
                    aria-hidden
                  />
                </div>
              </div>
            )}
          </div>
        </button>
      </div>

      <CanvasMinimapExpandedMenu
        open={expandedOpen}
        onClose={() => closeCanvasMinimap()}
        viewport={viewport}
        transformRef={transformRef}
      />
    </>
  )
}

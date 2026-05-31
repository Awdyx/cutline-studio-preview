import { useCallback, useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { CANVAS_OVERVIEW_TRANSITION_MS, toggleCanvasOverview } from './canvasOverviewCamera'
import { useCanvasOverviewStore } from './canvasOverviewStore'
import {
  canvasMinimapMapRegion,
  canvasMinimapStudioRect,
  canvasRectToRegionPercent,
  type CanvasMinimapPercentRect,
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
const MINIMAP_MOTION_EASE = [0.18, 1.22, 0.32, 1] as const
const MINIMAP_MOTION_S = CANVAS_OVERVIEW_TRANSITION_MS / 1000

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
  const showPreview = engaged && !expandedOpen
  const viewport = useCanvasMinimapViewport(transformRef, viewportRef, engaged)
  const viewportSquish = useCanvasMinimapViewportSquish(
    showPreview,
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

  const mapRegion = useMemo(() => canvasMinimapMapRegion(), [])

  const viewportPct = useMemo(
    () =>
      viewport ? canvasRectToRegionPercent(viewport, mapRegion) : null,
    [viewport, mapRegion],
  )

  const studioPct = useMemo(
    () => canvasRectToRegionPercent(canvasMinimapStudioRect(), mapRegion),
    [studioX, studioY, mapRegion],
  )

  const frameHeight = MINIMAP_WIDTH_PX / CANVAS_ASPECT
  const lastViewportPctRef = useRef(viewportPct)
  if (viewportPct) lastViewportPctRef.current = viewportPct
  const displayViewportPct = viewportPct ?? lastViewportPctRef.current

  const onToggleOverview = useCallback(() => {
    playSubmenuTap()
    if (engaged) closeCanvasMinimap()
    toggleCanvasOverview(transformRef.current, null)
  }, [engaged, transformRef])

  const previewMotion = {
    initial: reduceMotion
      ? { opacity: 0 }
      : { opacity: 0, y: 10, scale: 0.9, filter: 'blur(6px)' },
    animate: reduceMotion
      ? { opacity: 1 }
      : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
    exit: reduceMotion
      ? { opacity: 0, transition: { duration: 0.1 } }
      : {
          opacity: 0,
          y: 12,
          scale: 0.88,
          filter: 'blur(8px)',
          pointerEvents: 'none' as const,
          transition: {
            duration: MINIMAP_MOTION_S,
            ease: MINIMAP_MOTION_EASE,
          },
        },
  }

  return (
    <>
      <div className="canvas-nav-minimap">
        <AnimatePresence initial={false}>
          {showPreview && displayViewportPct && (
            <motion.button
              key="canvas-nav-minimap-preview"
              type="button"
              className="canvas-nav-minimap__preview"
              aria-label="Open canvas map"
              initial={previewMotion.initial}
              animate={previewMotion.animate}
              exit={previewMotion.exit}
              whileHover={
                reduceMotion
                  ? undefined
                  : { scale: 1.045, transition: { duration: 0.2 } }
              }
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              transition={
                reduceMotion
                  ? { duration: 0.12 }
                  : { duration: MINIMAP_MOTION_S * 0.62, ease: MINIMAP_MOTION_EASE }
              }
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

                <div
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
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        <motion.button
          type="button"
          className={`canvas-nav-minimap__toggle${
            engaged ? ' canvas-nav-minimap__toggle--active' : ''
          }`}
          aria-label={engaged ? 'Exit canvas overview' : 'Enter canvas overview'}
          aria-pressed={engaged}
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          onClick={onToggleOverview}
        >
          overview
        </motion.button>
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

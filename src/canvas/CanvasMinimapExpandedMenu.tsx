import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  canvasMinimapExpandedMapRegion,
  canvasRectToRegionPercent,
  CANVAS_MINIMAP_EXPANDED_WIDTH_PX,
  type CanvasMinimapRect,
} from './canvasMinimapGeometry'
import CanvasMinimapDestinationPlate from './CanvasMinimapDestinationPlate'
import { useCanvasMinimapStore } from './canvasMinimapStore'
import { playSound } from '../sound/playSound'
import { CANVAS_ASPECT } from '../drawing/canvasDimensions'
import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { useCanvasMinimapViewportSquish } from './useCanvasMinimapViewportSquish'
import { minimapViewportSquishTransform } from './canvasMinimapViewportSquish'
import { useCanvasMinimapMenuPointerGuard } from './useCanvasMinimapMenuPointerGuard'
import { font } from '../styles/tokens'

const EXPANDED_WIDTH_PX = CANVAS_MINIMAP_EXPANDED_WIDTH_PX
const DRAW_TAUNT_MS = 2600

/** Full canvas — plate positions are accurate within this fixed region. */
const MAP_REGION = canvasMinimapExpandedMapRegion()

type Props = {
  open: boolean
  onClose: () => void
  viewport: CanvasMinimapRect | null
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
}

export default function CanvasMinimapExpandedMenu({
  open,
  onClose,
  viewport,
  transformRef,
}: Props) {
  const reduceMotion = useReducedMotion()
  const viewportSquish = useCanvasMinimapViewportSquish(open, reduceMotion, transformRef)
  const frameRef = useRef<HTMLDivElement>(null)
  const spacesHintHoveredRef = useRef(false)
  const drawTauntTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showDrawTaunt, setShowDrawTaunt] = useState(false)
  const repositionHintOpen = useCanvasMinimapStore((s) => s.repositionHintOpen)

  const revealDrawTaunt = useCallback(() => {
    if (drawTauntTimerRef.current) clearTimeout(drawTauntTimerRef.current)
    setShowDrawTaunt(true)
    drawTauntTimerRef.current = setTimeout(() => {
      drawTauntTimerRef.current = null
      setShowDrawTaunt(false)
    }, DRAW_TAUNT_MS)
  }, [])

  useCanvasMinimapMenuPointerGuard(open, revealDrawTaunt)

  useEffect(() => {
    if (!repositionHintOpen) spacesHintHoveredRef.current = false
  }, [repositionHintOpen])

  useEffect(() => {
    useCanvasMinimapStore.getState().setExpandedOpen(open)
    const el = document.documentElement
    if (open) el.setAttribute('data-canvas-minimap-expanded', '')
    else el.removeAttribute('data-canvas-minimap-expanded')
    return () => {
      el.removeAttribute('data-canvas-minimap-expanded')
      useCanvasMinimapStore.getState().setExpandedOpen(false)
      if (drawTauntTimerRef.current) clearTimeout(drawTauntTimerRef.current)
      setShowDrawTaunt(false)
    }
  }, [open])

  const viewportPct = useMemo(
    () => (viewport ? canvasRectToRegionPercent(viewport, MAP_REGION) : null),
    [viewport],
  )

  const frameHeight = EXPANDED_WIDTH_PX / CANVAS_ASPECT

  const blockMenuPointerBubble = useCallback((event: React.PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }, [])

  const onSpacesHintEnter = useCallback(() => {
    if (spacesHintHoveredRef.current) return
    spacesHintHoveredRef.current = true
    playSound('spaceEnter')
  }, [])

  const onSpacesHintLeave = useCallback(() => {
    if (!spacesHintHoveredRef.current) return
    spacesHintHoveredRef.current = false
    playSound('spaceExit')
  }, [])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            className="canvas-minimap-expanded-scrim"
            aria-label="Close canvas map"
            onPointerDown={blockMenuPointerBubble}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0.1 } : { duration: 0.22 }}
            onClick={onClose}
          />
          <div className="canvas-minimap-expanded-menu" aria-hidden>
            <div className="canvas-minimap-expanded-menu__stack">
              {repositionHintOpen && (
                <motion.p
                  className="canvas-minimap-expanded-menu__reposition-hint"
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
                  transition={
                    reduceMotion
                      ? { duration: 0.1 }
                      : { duration: 0.24, ease: [0.22, 1, 0.36, 1], delay: 0.06 }
                  }
                >
                  you can drag{' '}
                  <span
                    className="canvas-minimap-expanded-menu__reposition-hint-em"
                    onPointerEnter={onSpacesHintEnter}
                    onPointerLeave={onSpacesHintLeave}
                  >
                    spaces
                  </span>{' '}
                  around through here ;P
                </motion.p>
              )}
              <div className="canvas-minimap-expanded-menu__map-anchor">
                <div className="canvas-minimap-expanded-menu__draw-taunt-slot" aria-hidden>
                  <AnimatePresence>
                    {showDrawTaunt && (
                      <motion.span
                        key="draw-taunt"
                        className="canvas-minimap-expanded-menu__draw-taunt"
                        initial={
                          reduceMotion
                            ? { opacity: 0 }
                            : { opacity: 0, y: 6, scale: 0.92 }
                        }
                        animate={
                          reduceMotion
                            ? { opacity: 1 }
                            : { opacity: 1, y: 0, scale: 1 }
                        }
                        exit={
                          reduceMotion
                            ? { opacity: 0 }
                            : { opacity: 0, y: 4, scale: 0.94 }
                        }
                        transition={
                          reduceMotion
                            ? { duration: 0.1 }
                            : { type: 'spring', stiffness: 400, damping: 28 }
                        }
                        style={{
                          fontFamily: font.family,
                          fontSize: 11,
                          fontWeight: 500,
                          color: 'var(--ui-text)',
                          opacity: 0.5,
                          letterSpacing: '-0.01em',
                        }}
                      >
                        really?
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <motion.div
                  ref={frameRef}
                  className="canvas-minimap-expanded-menu__frame"
                  role="dialog"
                  aria-label="Canvas map"
                  style={{ width: EXPANDED_WIDTH_PX, height: frameHeight }}
                  onPointerDown={blockMenuPointerBubble}
                  initial={
                    reduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, scale: 0.94, filter: 'blur(10px)' }
                  }
                  animate={
                    reduceMotion
                      ? { opacity: 1 }
                      : { opacity: 1, scale: 1, filter: 'blur(0px)' }
                  }
                  exit={
                    reduceMotion
                      ? { opacity: 0, transition: { duration: 0.1 } }
                      : {
                          opacity: 0,
                          scale: 0.96,
                          filter: 'blur(8px)',
                          transition: { duration: 0.2 },
                        }
                  }
                  transition={
                    reduceMotion
                      ? { duration: 0.12 }
                      : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }
                  }
                >
                  <div className="canvas-minimap-expanded-menu__frame-surface" aria-hidden>
                    <div className="canvas-minimap-expanded-menu__void" aria-hidden />
                    <div className="canvas-minimap-expanded-menu__grid" />
                  </div>

                  <CanvasMinimapDestinationPlate
                    mapRegion={MAP_REGION}
                    transformRef={transformRef}
                    frameRef={frameRef}
                  />

                  {viewportPct && (
                    <div
                      className="canvas-minimap-expanded-menu__viewport"
                      style={{
                        left: `${viewportPct.left}%`,
                        top: `${viewportPct.top}%`,
                        width: `${Math.max(viewportPct.width, 2)}%`,
                        height: `${Math.max(viewportPct.height, 2)}%`,
                        zIndex: 3,
                      }}
                    >
                      <div
                        className="canvas-minimap-expanded-menu__viewport-squish"
                        style={{
                          transform: minimapViewportSquishTransform(viewportSquish),
                          transformOrigin: `${viewportSquish.originX}% ${viewportSquish.originY}%`,
                        }}
                      >
                        <div
                          className="canvas-minimap-expanded-menu__viewport-corners"
                          aria-hidden
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>
              <motion.span
                className="canvas-minimap-expanded-menu__label"
                aria-hidden
                initial={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: 6, filter: 'blur(4px)' }
                }
                animate={
                  reduceMotion
                    ? { opacity: 1 }
                    : { opacity: 1, y: 0, filter: 'blur(0px)' }
                }
                exit={
                  reduceMotion
                    ? { opacity: 0, transition: { duration: 0.1 } }
                    : {
                        opacity: 0,
                        y: 4,
                        filter: 'blur(4px)',
                        transition: { duration: 0.16 },
                      }
                }
                transition={
                  reduceMotion
                    ? { duration: 0.12 }
                    : { duration: 0.28, ease: [0.22, 1, 0.36, 1], delay: 0.04 }
                }
              >
                canvas map
              </motion.span>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

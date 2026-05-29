import { Grip } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { useCanvasFisheyeStore } from './canvasFisheyeStore'
import type { FeaturePlateDestination } from './canvasPlate'
import { onFeaturePlateDragPointerDown } from './featurePlateDrag'
import { useStudioCentreDragStore } from './studioCentreDragStore'

const HANDLE_HIT = 280
const HANDLE_VISUAL = 88
const HANDLE_GAP = 16
const HANDLE_OUTSET = (HANDLE_HIT - HANDLE_VISUAL) / 2

const HANDLE_MOTION_EASE = [0.18, 1.22, 0.32, 1] as const
const HANDLE_MOTION_S = 0.44
const MINIMAP_DRAG_CHROME_FADE_S = 0.24

type Props = {
  destination: FeaturePlateDestination
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
}

export default function FeaturePlateDragHandle({ destination, transformRef }: Props) {
  const engaged = useCanvasFisheyeStore((s) => s.engaged)
  const minimapDragging = useStudioCentreDragStore((s) => s.minimapDragging)
  const reduceMotion = useReducedMotion()
  const chromeVisible = !minimapDragging

  return (
    <AnimatePresence>
      {engaged && (
        <motion.div
          key={`feature-plate-drag-${destination}`}
          className="feature-plate-drag-handle-wrapper"
          initial={
            reduceMotion
              ? { opacity: 0 }
              : { opacity: 0, x: -40, y: -40, scale: 0.82, filter: 'blur(12px)' }
          }
          animate={
            reduceMotion
              ? { opacity: chromeVisible ? 1 : 0 }
              : {
                  opacity: chromeVisible ? 1 : 0,
                  x: 0,
                  y: 0,
                  scale: 1,
                  filter: 'blur(0px)',
                }
          }
          exit={
            reduceMotion
              ? { opacity: 0, transition: { duration: 0.1 } }
              : {
                  opacity: 0,
                  x: -40,
                  y: -40,
                  scale: 0.82,
                  filter: 'blur(12px)',
                  transition: { duration: HANDLE_MOTION_S * 0.82, ease: HANDLE_MOTION_EASE },
                }
          }
          transition={
            reduceMotion
              ? { duration: 0.12 }
              : {
                  opacity: { duration: MINIMAP_DRAG_CHROME_FADE_S, ease: 'easeOut' },
                  duration: HANDLE_MOTION_S,
                  ease: HANDLE_MOTION_EASE,
                }
          }
          style={{
            position: 'absolute',
            left: -(HANDLE_VISUAL + HANDLE_GAP + HANDLE_OUTSET),
            top: HANDLE_OUTSET * -1,
            width: HANDLE_HIT,
            height: HANDLE_HIT,
            zIndex: 4,
            pointerEvents: chromeVisible ? 'auto' : 'none',
          }}
        >
          <button
            type="button"
            aria-label={`Move ${destination} space`}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              useStudioCentreDragStore.getState().setPanSuppressed(true)
              onFeaturePlateDragPointerDown(destination, transformRef, e, {
                dragThresholdPx: 0,
                commitImmediately: true,
              })
            }}
            className="feature-plate-drag-handle"
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              border: 'none',
              background: 'transparent',
              color: 'var(--canvas-handle-color)',
              cursor: 'grab',
              touchAction: 'none',
            }}
          >
            <Grip size={HANDLE_VISUAL} strokeWidth={1.5} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

import { Grip } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { useCanvasFisheyeStore } from './canvasFisheyeStore'
import { onStudioCentreDragPointerDown } from './studioCentreDrag'
import { useStudioCentreDragStore } from './studioCentreDragStore'

/** Massive fisheye-only drag handle — top-left of the studio centre. */
const STUDIO_HANDLE_HIT = 340
const STUDIO_HANDLE_VISUAL = 108
const STUDIO_HANDLE_GAP = 18
const STUDIO_HANDLE_OUTSET = (STUDIO_HANDLE_HIT - STUDIO_HANDLE_VISUAL) / 2

const HANDLE_MOTION_EASE = [0.18, 1.22, 0.32, 1] as const
const HANDLE_MOTION_S = 0.44
const MINIMAP_DRAG_CHROME_FADE_S = 0.24

type Props = {
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
}

export default function StudioCentreDragHandle({ transformRef }: Props) {
  const engaged = useCanvasFisheyeStore((s) => s.engaged)
  const minimapDragging = useStudioCentreDragStore((s) => s.minimapDragging)
  const reduceMotion = useReducedMotion()
  const chromeVisible = !minimapDragging

  return (
    <AnimatePresence>
      {engaged && (
        <motion.div
          key="studio-centre-drag-handle"
          className="studio-centre-drag-handle-wrapper"
          initial={
            reduceMotion
              ? { opacity: 0 }
              : {
                  opacity: 0,
                  x: -52,
                  y: -52,
                  scale: 0.82,
                  filter: 'blur(14px)',
                }
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
                  x: -52,
                  y: -52,
                  scale: 0.82,
                  filter: 'blur(14px)',
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
            left: -(STUDIO_HANDLE_VISUAL + STUDIO_HANDLE_GAP + STUDIO_HANDLE_OUTSET),
            top: STUDIO_HANDLE_OUTSET * -1,
            width: STUDIO_HANDLE_HIT,
            height: STUDIO_HANDLE_HIT,
            zIndex: 7000,
            pointerEvents: chromeVisible ? 'auto' : 'none',
            transformOrigin: 'center center',
          }}
        >
          <button
            type="button"
            aria-label="Move studio canvas"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              useStudioCentreDragStore.getState().setPanSuppressed(true)
              onStudioCentreDragPointerDown(transformRef, e, {
                dragThresholdPx: 0,
                commitImmediately: true,
              })
            }}
            className="studio-centre-drag-handle"
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              border: 'none',
              borderRadius: 0,
              background: 'transparent',
              color: 'var(--canvas-handle-color)',
              cursor: 'grab',
              touchAction: 'none',
            }}
          >
            <Grip size={STUDIO_HANDLE_VISUAL} strokeWidth={1.5} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

import { useCallback } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { openCanvasMinimapFromReposition } from './canvasMinimapOpen'
import type { FeaturePlateDestination } from './canvasPlate'
import { useCanvasFisheyeStore } from './canvasFisheyeStore'
import { useStudioCentreDragStore } from './studioCentreDragStore'
import { playSubmenuTap } from '../sound/submenuSound'

const REPOSITION_MOTION_EASE = [0.18, 1.22, 0.32, 1] as const
const REPOSITION_MOTION_S = 0.44
const MINIMAP_DRAG_CHROME_FADE_S = 0.24
const REPOSITION_DRAG_BLUR = 'blur(12px)'
const REPOSITION_CLEAR_BLUR = 'blur(0px)'

type Props = {
  /** Omit for the studio centre plate. */
  destination?: FeaturePlateDestination
}

/** Massive control below a canvas plate — opens the expanded canvas map. */
export default function CanvasPlateRepositionButton({ destination }: Props) {
  const engaged = useCanvasFisheyeStore((s) => s.engaged)
  const minimapDragging = useStudioCentreDragStore((s) => s.minimapDragging)
  const studioCentreDragging = useStudioCentreDragStore((s) => s.studioCentreDragging)
  const featurePlateDragging = useStudioCentreDragStore((s) => s.featurePlateDragging)
  const reduceMotion = useReducedMotion()

  const plateDragging = destination
    ? featurePlateDragging === destination
    : studioCentreDragging
  const chromeVisible = !minimapDragging && !plateDragging

  const onClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    playSubmenuTap()
    openCanvasMinimapFromReposition()
  }, [])

  const key = destination ? `feature-plate-reposition-${destination}` : 'studio-centre-reposition'

  return (
    <AnimatePresence>
      {engaged && (
        <motion.button
          key={key}
          type="button"
          className="canvas-plate-reposition-btn"
          aria-label="Open canvas map to reposition pockets"
          style={{ x: '-50%', pointerEvents: chromeVisible ? 'auto' : 'none' }}
          initial={
            reduceMotion
              ? { opacity: 0 }
              : {
                  opacity: 0,
                  y: 64,
                  scale: 0.92,
                  filter: REPOSITION_DRAG_BLUR,
                }
          }
          animate={
            reduceMotion
              ? { opacity: chromeVisible ? 1 : 0 }
              : {
                  opacity: chromeVisible ? 1 : 0,
                  y: 0,
                  scale: 1,
                  filter: chromeVisible ? REPOSITION_CLEAR_BLUR : REPOSITION_DRAG_BLUR,
                }
          }
          exit={
            reduceMotion
              ? { opacity: 0, transition: { duration: 0.1 } }
              : {
                  opacity: 0,
                  y: 64,
                  scale: 0.92,
                  filter: REPOSITION_DRAG_BLUR,
                  transition: {
                    duration: REPOSITION_MOTION_S * 0.82,
                    ease: REPOSITION_MOTION_EASE,
                  },
                }
          }
          transition={
            reduceMotion
              ? { duration: 0.12 }
              : {
                  opacity: { duration: MINIMAP_DRAG_CHROME_FADE_S, ease: 'easeOut' },
                  filter: { duration: MINIMAP_DRAG_CHROME_FADE_S, ease: 'easeOut' },
                  y: { duration: REPOSITION_MOTION_S, ease: REPOSITION_MOTION_EASE, delay: 0.06 },
                  scale: { duration: REPOSITION_MOTION_S, ease: REPOSITION_MOTION_EASE, delay: 0.06 },
                }
          }
          onClick={onClick}
        >
          reposition
        </motion.button>
      )}
    </AnimatePresence>
  )
}

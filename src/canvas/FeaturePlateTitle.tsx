import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCanvasFisheyeStore } from './canvasFisheyeStore'
import { useAppDestinationActive } from '../navigation/useAppDestinationActive'
import {
  FEATURE_PLATE_TITLES,
  FEATURE_PLATE_TITLE_SUFFIX,
  type FeaturePlateDestination,
} from './canvasPlate'

const TITLE_MOTION_EASE = [0.18, 1.22, 0.32, 1] as const
const TITLE_MOTION_MS = 0.54

type Props = {
  destination: FeaturePlateDestination
}

export default function FeaturePlateTitle({ destination }: Props) {
  const engaged = useCanvasFisheyeStore((s) => s.engaged)
  const reduceMotion = useReducedMotion()
  const active = useAppDestinationActive(destination)
  const label = FEATURE_PLATE_TITLES[destination]

  return (
    <AnimatePresence>
      {engaged && (
        <motion.p
          key={`feature-plate-title-${destination}`}
          className={`feature-plate-title studio-centre-title${
            active ? ' studio-centre-title--active' : ''
          }`}
          aria-hidden
          initial={
            reduceMotion
              ? { opacity: 0 }
              : {
                  opacity: 0,
                  y: -72,
                  scale: 1.12,
                  filter: 'blur(14px)',
                  clipPath: 'inset(0 100% 8% 0)',
                }
          }
          animate={
            reduceMotion
              ? { opacity: 1 }
              : {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  filter: 'blur(0px)',
                  clipPath: 'none',
                }
          }
          exit={
            reduceMotion
              ? { opacity: 0, transition: { duration: 0.1 } }
              : {
                  opacity: 0,
                  y: -72,
                  scale: 1.12,
                  filter: 'blur(14px)',
                  clipPath: 'inset(0 100% 8% 0)',
                  transition: { duration: TITLE_MOTION_MS, ease: TITLE_MOTION_EASE },
                }
          }
          transition={
            reduceMotion
              ? { duration: 0.12 }
              : { duration: TITLE_MOTION_MS, ease: TITLE_MOTION_EASE }
          }
        >
          <span className="studio-centre-title__word">
            <span className="studio-centre-title__word-live">{label}</span>
          </span>
          <span className="studio-centre-title__heart">
            {FEATURE_PLATE_TITLE_SUFFIX[destination]}
          </span>
        </motion.p>
      )}
    </AnimatePresence>
  )
}

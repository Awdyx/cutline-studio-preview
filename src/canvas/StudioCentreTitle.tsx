import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCanvasFisheyeStore } from './canvasFisheyeStore'
import { useAppDestinationActive } from '../navigation/useAppDestinationActive'

const STUDIO_TITLE_WORD = 'studio'
const STUDIO_TITLE_HEART = '<3'

const TITLE_MOTION_EASE = [0.18, 1.22, 0.32, 1] as const
const TITLE_MOTION_MS = 0.54

/** Massive label above the studio-centre — fisheye overview only. */
export default function StudioCentreTitle() {
  const engaged = useCanvasFisheyeStore((s) => s.engaged)
  const reduceMotion = useReducedMotion()
  const active = useAppDestinationActive('studio')

  return (
    <AnimatePresence>
      {engaged && (
        <motion.p
          key="studio-centre-title"
          className={`studio-centre-title${active ? ' studio-centre-title--active' : ''}`}
          aria-hidden
          initial={
            reduceMotion
              ? { opacity: 0 }
              : {
                  opacity: 0,
                  y: -88,
                  scale: 1.16,
                  filter: 'blur(16px)',
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
                  y: -88,
                  scale: 1.16,
                  filter: 'blur(16px)',
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
          <span className="studio-centre-title__glow">
            <span className="studio-centre-title__word">
              <span className="studio-centre-title__word-size" aria-hidden>
                {STUDIO_TITLE_WORD}
              </span>
              <span className="studio-centre-title__word-live">{STUDIO_TITLE_WORD}</span>
            </span>
            <span className="studio-centre-title__heart">{STUDIO_TITLE_HEART}</span>
          </span>
        </motion.p>
      )}
    </AnimatePresence>
  )
}

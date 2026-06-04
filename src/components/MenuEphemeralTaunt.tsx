import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { font } from '../styles/tokens'

export const LIGHT_MODE_TAUNT_TEXT = 'switch to light mode first'
const DEFAULT_DURATION_MS = 2200
/** Gap between taunt baseline and anchored section top. */
const TAUNT_GAP_PX = 14

export function useMenuEphemeralTaunt(durationMs = DEFAULT_DURATION_MS) {
  const [show, setShow] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const trigger = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setShow(true)
    timerRef.current = setTimeout(() => setShow(false), durationMs)
  }, [durationMs])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { show, trigger }
}

type MenuEphemeralTauntProps = {
  show: boolean
  anchorRef: RefObject<HTMLElement | null>
  children: ReactNode
}

/** Small fixed-position hint anchored above a menu section (portaled). */
export function MenuEphemeralTaunt({ show, anchorRef, children }: MenuEphemeralTauntProps) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  const updatePos = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({ left: rect.left + rect.width / 2, top: rect.top - TAUNT_GAP_PX })
  }, [anchorRef])

  useLayoutEffect(() => {
    if (!show) return
    updatePos()
  }, [show, updatePos])

  useEffect(() => {
    if (!show) return
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => {
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [show, updatePos])

  if (!pos) return null

  return createPortal(
    <AnimatePresence onExitComplete={() => setPos(null)}>
      {show && (
        <motion.span
          key="menu-taunt"
          initial={{ opacity: 0, y: 4, scale: 0.92 }}
          animate={{ opacity: 0.5, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          style={{
            position: 'fixed',
            left: pos.left,
            top: pos.top,
            translate: '-50% -100%',
            zIndex: 41,
            fontFamily: font.family,
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--ui-text)',
            letterSpacing: '-0.01em',
            pointerEvents: 'none',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            transformOrigin: 'center bottom',
          }}
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>,
    document.body,
  )
}

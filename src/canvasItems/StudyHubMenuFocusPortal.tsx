import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import type { StudyPracticeSelection } from '../components/study/StudyHubPracticePicker'
import { card } from '../styles/tokens'
import StudyHubWidget from './StudyHubWidget'
import type { StudyHubCanvasItem } from './types'
import { STUDY_HUB_HEIGHT, STUDY_HUB_WIDTH } from './types'
import { studyHubBorderRadiusCss } from './studyHubSpawnScale'
import { useCanvasItemScrollCapture } from './useCanvasItemScrollCapture'
import { useCanvasItemScreenRect } from './useCanvasItemScreenRect'

const MENU_FOCUS_PORTAL_Z = 24
const MENU_FOCUS_TRANSITION_MS = 200

export default function StudyHubMenuFocusPortal({
  item,
  transformRef,
  active,
  focused,
  dismissing = false,
  practice,
  onPracticeChange,
  scrollRef,
  onDismiss,
}: {
  item: StudyHubCanvasItem
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  /** Keep mounted + track screen rect (focused or finishing zoom-out). */
  active: boolean
  /** Menu-focus chrome is in its visible state (not exiting). */
  focused: boolean
  dismissing?: boolean
  practice: StudyPracticeSelection
  onPracticeChange: (next: StudyPracticeSelection) => void
  scrollRef: RefObject<HTMLDivElement | null>
  onDismiss: (e: React.MouseEvent | React.PointerEvent) => void
}) {
  const reduceMotion = useReducedMotion()
  const screenRect = useCanvasItemScreenRect(item, transformRef, active)
  useCanvasItemScrollCapture(scrollRef)

  const focusChrome = reduceMotion
    ? { opacity: 0, filter: 'blur(0px)' }
    : { opacity: 0, filter: 'blur(4px)' }

  const focusTransition = {
    duration: reduceMotion ? 0.01 : MENU_FOCUS_TRANSITION_MS / 1000,
    ease: 'easeOut' as const,
  }

  const shown = focused && !dismissing

  if (!active || !screenRect || screenRect.width <= 0 || screenRect.height <= 0) {
    return null
  }

  return createPortal(
    <motion.div
      className="study-hub-menu-focus-portal"
      data-study-hub-menu-focus=""
      initial={focusChrome}
      animate={shown ? { opacity: 1, filter: 'blur(0px)' } : focusChrome}
      transition={focusTransition}
      style={{
        position: 'fixed',
        left: screenRect.left,
        top: screenRect.top,
        width: screenRect.width,
        height: screenRect.height,
        zIndex: MENU_FOCUS_PORTAL_Z,
        pointerEvents: shown ? 'auto' : 'none',
        borderRadius: studyHubBorderRadiusCss(screenRect.width),
        overflow: 'hidden',
        boxShadow: card.shadow,
      }}
    >
      <div
        style={{
          width: STUDY_HUB_WIDTH,
          height: STUDY_HUB_HEIGHT,
          transform: `scale(${screenRect.width / STUDY_HUB_WIDTH})`,
          transformOrigin: 'top left',
        }}
      >
        <StudyHubWidget
          subjectId={item.subjectId}
          practice={practice}
          onPracticeChange={onPracticeChange}
          scrollRef={scrollRef}
          showDismiss
          onDismiss={onDismiss}
        />
      </div>
    </motion.div>,
    document.body,
  )
}

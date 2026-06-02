import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import type { StudyPracticeSelection } from '../components/study/StudyHubPracticePicker'
import StudyHubWidget from './StudyHubWidget'
import StudyHubMenuFocusFrame from './StudyHubMenuFocusFrame'
import { useCanvasItemsStore } from './canvasItemsStore'
import type { StudyHubCanvasItem } from './types'
import { STUDY_HUB_OVERLAY_TRANSITION_MS } from './studyHubMenuFocus'
import { chromeOverlayPortalRoot } from '../platform/chromeOverlayPortal'
import { useCanvasItemScrollCapture } from './useCanvasItemScrollCapture'
import { useCanvasItemScreenRect } from './useCanvasItemScreenRect'

const MENU_FOCUS_PORTAL_Z = 1

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
  active: boolean
  focused: boolean
  dismissing?: boolean
  practice: StudyPracticeSelection
  onPracticeChange: (next: StudyPracticeSelection) => void
  scrollRef: RefObject<HTMLDivElement | null>
  onDismiss: (e: React.MouseEvent | React.PointerEvent) => void
}) {
  const reduceMotion = useReducedMotion()
  const dismissScratchClosing = useCanvasItemsStore(
    (s) => s.menuFocusDismissScratchClosing,
  )
  const liveRect = useCanvasItemScreenRect(item, transformRef, active)
  const [frozenRect, setFrozenRect] = useState<DOMRect | null>(null)
  useCanvasItemScrollCapture(scrollRef)

  const scratchClosingPhase = dismissing && dismissScratchClosing
  const zoomDismissPhase = dismissing && !dismissScratchClosing

  useEffect(() => {
    if (!dismissing) {
      setFrozenRect(null)
      return
    }
    if (scratchClosingPhase) return
    if (liveRect) {
      setFrozenRect((prev) => prev ?? liveRect)
    }
  }, [dismissing, scratchClosingPhase, liveRect])

  const hubRect =
    zoomDismissPhase ? frozenRect ?? liveRect : liveRect

  const hidden = reduceMotion ? { opacity: 0 } : { opacity: 0 }
  const focusTransition = {
    duration: reduceMotion ? 0.01 : STUDY_HUB_OVERLAY_TRANSITION_MS / 1000,
    ease: 'easeOut' as const,
  }
  const portalVisible = focused || scratchClosingPhase
  const chromeVisible = focused && !dismissing

  if (!active || !hubRect || hubRect.width <= 0 || hubRect.height <= 0) {
    return null
  }

  return createPortal(
    <motion.div
      className="study-hub-menu-focus-portal"
      data-study-hub-menu-focus=""
      initial={hidden}
      animate={portalVisible ? { opacity: 1 } : hidden}
      transition={focusTransition}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: MENU_FOCUS_PORTAL_Z,
        pointerEvents: portalVisible ? 'auto' : 'none',
        overflow: 'visible',
      }}
    >
      <StudyHubMenuFocusFrame
        hubRect={hubRect}
        transformRef={transformRef}
        chromeVisible={chromeVisible}
        onDismiss={onDismiss}
      >
        <StudyHubWidget
          subjectId={item.subjectId}
          practice={practice}
          onPracticeChange={onPracticeChange}
          scrollRef={scrollRef}
        />
      </StudyHubMenuFocusFrame>
    </motion.div>,
    chromeOverlayPortalRoot(),
  )
}

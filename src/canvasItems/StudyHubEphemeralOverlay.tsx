import { createPortal } from 'react-dom'
import { useEffect, useRef, useState, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  DEFAULT_STUDY_PRACTICE,
  type StudyPracticeSelection,
} from '../components/study/StudyHubPracticePicker'
import StudyHubWidget from './StudyHubWidget'
import StudyHubMenuFocusFrame from './StudyHubMenuFocusFrame'
import { useCanvasItemsStore } from './canvasItemsStore'
import { dismissStudyHubMenuFocus } from './studyHubMenuFocus'
import { studyHubEphemeralSelectionBlurPx } from '../canvas/canvasCamera'
import { chromeOverlayPortalRoot } from '../platform/chromeOverlayPortal'
import { useCanvasItemScrollCapture } from './useCanvasItemScrollCapture'
import { useStudyHubMenuFocusScreenRect } from './useCanvasItemScreenRect'

const OVERLAY_Z = 1

/** Shortcut-only study hub — one fixed screen overlay, no canvas item. */
export default function StudyHubEphemeralOverlay({
  transformRef,
}: {
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [practice, setPractice] = useState<StudyPracticeSelection>(
    DEFAULT_STUDY_PRACTICE,
  )
  const [frozenRect, setFrozenRect] = useState<DOMRect | null>(null)

  const subjectId = useCanvasItemsStore((s) => s.menuFocusEphemeralSubjectId)
  const revealed = useCanvasItemsStore((s) => s.menuFocusRevealed)
  const dismissing = useCanvasItemsStore((s) => s.menuFocusDismissing)

  const mounted = subjectId != null
  const panelVisible = mounted && revealed && !dismissing
  const blurBoostActive = mounted && (revealed || dismissing)
  const liveRect = useStudyHubMenuFocusScreenRect(transformRef, mounted)

  useCanvasItemScrollCapture(scrollRef)

  useEffect(() => {
    if (!subjectId) {
      setPractice(DEFAULT_STUDY_PRACTICE)
    }
  }, [subjectId])

  useEffect(() => {
    const root = document.documentElement
    if (!blurBoostActive) {
      root.style.removeProperty('--selection-depth-blur')
      return
    }

    const px = studyHubEphemeralSelectionBlurPx(transformRef.current)
    root.style.setProperty('--selection-depth-blur', `${px}px`)
    return () => {
      root.style.removeProperty('--selection-depth-blur')
    }
  }, [blurBoostActive, transformRef])

  useEffect(() => {
    if (dismissing && liveRect) {
      setFrozenRect(liveRect)
      return
    }
    if (!dismissing) {
      setFrozenRect(null)
    }
  }, [dismissing, liveRect])

  const screenRect = dismissing ? frozenRect ?? liveRect : liveRect

  if (!mounted || !screenRect || screenRect.width <= 0) {
    return null
  }

  function handleDismiss(e: React.MouseEvent | React.PointerEvent) {
    e.stopPropagation()
    e.preventDefault()
    dismissStudyHubMenuFocus(transformRef.current)
  }

  return createPortal(
    <div
      className="study-hub-menu-focus-portal study-hub-ephemeral-overlay"
      data-study-hub-menu-focus=""
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: OVERLAY_Z,
        pointerEvents: panelVisible ? 'auto' : 'none',
        overflow: 'visible',
      }}
    >
      <StudyHubMenuFocusFrame
        hubRect={screenRect}
        transformRef={transformRef}
        chromeVisible={panelVisible}
        hubPanelClassName={`study-hub-ephemeral-overlay__panel${panelVisible ? ' is-visible' : ''}`}
        onDismiss={handleDismiss}
      >
        <StudyHubWidget
          subjectId={subjectId}
          practice={practice}
          onPracticeChange={setPractice}
          scrollRef={scrollRef}
        />
      </StudyHubMenuFocusFrame>
    </div>,
    chromeOverlayPortalRoot(),
  )
}

import { AnimatePresence, motion } from 'framer-motion'
import { SELECTION_DEPTH_CLASS } from '../styles/tokens'
import { useCanvasItemsStore } from './canvasItemsStore'
import { useLassoStore } from '../drawing/useLassoStore'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import { useCanvasCustomizeBlurHandoff } from '../uiCustomization/useCanvasCustomizeBlurHandoff'
import {
  CANVAS_CUSTOMIZE_BLUR_RELEASE_TRANSITION,
  UI_CUSTOMIZE_BACKDROP_ENTER,
} from '../uiCustomization/canvasItemCustomizeLayout'
import {
  STUDY_HUB_EPHEMERAL_FADE_EASE,
  STUDY_HUB_EPHEMERAL_FADE_MS,
} from './studyHubMenuFocus'

/** Blurs the outer canvas void (grid/plates) behind the studio draw target during item selection. */
export default function SelectionBlurCanvasBackdrop() {
  const show = useCanvasItemsStore((s) => s.selectedIds.length > 0)
  const ephemeralStudyHub = useCanvasItemsStore(
    (s) => s.menuFocusEphemeralSubjectId != null,
  )
  const menuFocusRevealed = useCanvasItemsStore((s) => s.menuFocusRevealed)
  const menuFocusDismissing = useCanvasItemsStore((s) => s.menuFocusDismissing)
  const isInsideSpace = useCanvasWorkspaceStore((s) => s.activeCanvasId !== 'main')
  const isLassoActive = useLassoStore(
    (s) => s.selectedStrokeIds.length > 0 || s.selectedItemIds.length > 0,
  )
  const { holdSelectionBlur, customizeBlurFading } =
    useCanvasCustomizeBlurHandoff()
  const showBackdrop =
    (show || ephemeralStudyHub || holdSelectionBlur) &&
    !isLassoActive &&
    !isInsideSpace
  /** Only skip the fade when selection blur was already visible — not when customize first mounts it. */
  const skipBlurEnter = show
  const ephemeralBlurOpacity = ephemeralStudyHub
    ? menuFocusRevealed && !menuFocusDismissing
      ? 1
      : 0
    : customizeBlurFading
      ? 0
      : 1

  return (
    <AnimatePresence>
      {showBackdrop && (
        <motion.div
          key="selection-blur-canvas-backdrop"
          initial={skipBlurEnter ? false : { opacity: 0 }}
          animate={{ opacity: ephemeralBlurOpacity }}
          exit={{ opacity: 0 }}
          transition={
            customizeBlurFading
              ? CANVAS_CUSTOMIZE_BLUR_RELEASE_TRANSITION
              : ephemeralStudyHub
                ? {
                    duration: STUDY_HUB_EPHEMERAL_FADE_MS / 1000,
                    ease: STUDY_HUB_EPHEMERAL_FADE_EASE,
                  }
                : holdSelectionBlur && !show
                  ? UI_CUSTOMIZE_BACKDROP_ENTER
                  : { duration: 0.22, ease: 'easeOut' as const }
          }
          aria-hidden
          className={SELECTION_DEPTH_CLASS}
          data-lock-flatten-skip
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />
      )}
    </AnimatePresence>
  )
}

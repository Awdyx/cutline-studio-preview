import { AnimatePresence, motion } from 'framer-motion'
import { SELECTION_DEPTH_CLASS } from '../styles/tokens'
import { useSelectionBlurDocumentState } from './useSelectionBlurDocumentState'
import { Z_MENU_FOCUS_BLOCKER, Z_SELECTION_DIM } from './canvasZOrder'
import { useCanvasItemsStore } from './canvasItemsStore'
import { useLassoStore } from '../drawing/useLassoStore'
import { usePocketStripStore } from '../spaces/pocketStripStore'
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

/** Oversized scrim so selection blur/dim covers the full pan surface, not just the studio clip. */
export const SELECTION_SCRIM_BLEED = 5000

function selectionScrimStyle(): React.CSSProperties {
  return {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: SELECTION_SCRIM_BLEED,
    height: SELECTION_SCRIM_BLEED,
    transform: 'translate(-50%, -50%)',
  }
}

/** Full-canvas blur behind selected items. Skipped for lasso selections — those use LassoSelectionBlur instead. */
export default function SelectionBlurOverlay() {
  const isInsideSpace = useCanvasWorkspaceStore((s) => s.activeCanvasId !== 'main')
  const pocketScrollY = usePocketStripStore((s) => s.scrollY)
  const pocketViewportHeight = usePocketStripStore((s) => s.viewportHeight)
  const pocketScale = usePocketStripStore((s) => s.scale)
  const show = useCanvasItemsStore((s) => s.selectedIds.length > 0)
  const ephemeralStudyHub = useCanvasItemsStore(
    (s) => s.menuFocusEphemeralSubjectId != null,
  )
  const menuFocusRevealed = useCanvasItemsStore((s) => s.menuFocusRevealed)
  const menuFocusDismissing = useCanvasItemsStore((s) => s.menuFocusDismissing)
  const menuFocusBlocksInteraction = useCanvasItemsStore(
    (s) =>
      (s.menuFocusEphemeralSubjectId != null &&
        (s.menuFocusRevealed || s.menuFocusDismissing)) ||
      (s.menuFocusReturnCamera != null && s.menuFocusRevealed) ||
      s.menuFocusDismissing,
  )
  const isLassoActive = useLassoStore(
    (s) => s.selectedStrokeIds.length > 0 || s.selectedItemIds.length > 0,
  )
  const { holdSelectionBlur, customizeBlurFading, blurReleasing } =
    useCanvasCustomizeBlurHandoff()
  const showFullBlur =
    (show || ephemeralStudyHub || holdSelectionBlur) && !isLassoActive
  const keepSelectionBlurAttr = showFullBlur || blurReleasing
  /** Only skip the fade when selection blur was already visible — not when study-hub focus is starting. */
  const skipBlurEnter = useCanvasItemsStore(
    (s) =>
      s.selectedIds.length > 0 &&
      (s.menuFocusReturnCamera == null || s.menuFocusRevealed),
  )
  const scrimBleed = !isInsideSpace && (menuFocusBlocksInteraction || showFullBlur)
  const pocketScrimHeight = pocketViewportHeight / Math.max(pocketScale, 0.001)
  const pocketScrimTop = pocketScrollY - pocketScrimHeight / 2
  const scrimStyle: React.CSSProperties = isInsideSpace
    ? {
        position: 'absolute',
        left: 0,
        width: '100%',
        top: pocketScrimTop,
        height: pocketScrimHeight,
      }
    : scrimBleed
      ? selectionScrimStyle()
      : { position: 'absolute', inset: 0 }
  const ephemeralBlurOpacity = ephemeralStudyHub
    ? menuFocusRevealed && !menuFocusDismissing
      ? 1
      : 0
    : customizeBlurFading
      ? 0
      : 1

  useSelectionBlurDocumentState(keepSelectionBlurAttr)

  return (
    <>
      <AnimatePresence>
        {showFullBlur && (
          <motion.div
            key="selection-blur"
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
              ...scrimStyle,
              zIndex: Z_SELECTION_DIM,
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      {menuFocusBlocksInteraction && !isLassoActive && (
        <div
          aria-hidden
          className="study-hub-menu-focus-blocker"
          data-study-hub-menu-focus-blocker=""
          data-lock-flatten-skip
          style={{
            ...scrimStyle,
            zIndex: Z_MENU_FOCUS_BLOCKER,
            pointerEvents: 'auto',
          }}
        />
      )}
    </>
  )
}

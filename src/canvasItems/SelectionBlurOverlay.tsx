import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { SELECTION_DEPTH_CLASS } from '../styles/tokens'
import { Z_MENU_FOCUS_BLOCKER, Z_SELECTION_DIM } from './canvasZOrder'
import { useCanvasItemsStore } from './canvasItemsStore'
import { useLassoStore } from '../drawing/useLassoStore'

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
  const show = useCanvasItemsStore((s) => s.selectedIds.length > 0)
  const menuFocusBlocksInteraction = useCanvasItemsStore(
    (s) => s.menuFocusReturnCamera != null || s.menuFocusDismissing,
  )
  const isLassoActive = useLassoStore(
    (s) => s.selectedStrokeIds.length > 0 || s.selectedItemIds.length > 0,
  )
  // Lasso selections get their own positioned blur (LassoSelectionBlur)
  const showFullBlur = show && !isLassoActive
  const scrimBleed = menuFocusBlocksInteraction || showFullBlur

  useEffect(() => {
    if (!showFullBlur) {
      document.documentElement.removeAttribute('data-selection-blur-active')
      return
    }
    document.documentElement.setAttribute('data-selection-blur-active', '')
    return () => document.documentElement.removeAttribute('data-selection-blur-active')
  }, [showFullBlur])

  return (
    <>
      <AnimatePresence>
        {showFullBlur && (
          <motion.div
            key="selection-blur"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            aria-hidden
            className={`${SELECTION_DEPTH_CLASS}${scrimBleed ? ' ui-selection-depth--menu-focus' : ''}`}
            data-lock-flatten-skip
            style={{
              ...(scrimBleed ? selectionScrimStyle() : { position: 'absolute', inset: 0 }),
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
            ...(selectionScrimStyle()),
            zIndex: Z_MENU_FOCUS_BLOCKER,
            pointerEvents: 'auto',
          }}
        />
      )}
    </>
  )
}

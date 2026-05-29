import { AnimatePresence, motion } from 'framer-motion'
import { SELECTION_DEPTH_CLASS } from '../styles/tokens'
import { useCanvasItemsStore } from './canvasItemsStore'
import { useLassoStore } from '../drawing/useLassoStore'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'

/** Blurs the outer canvas void (grid/plates) behind the studio draw target during item selection. */
export default function SelectionBlurCanvasBackdrop() {
  const show = useCanvasItemsStore((s) => s.selectedIds.length > 0)
  const isInsideSpace = useCanvasWorkspaceStore((s) => s.activeCanvasId !== 'main')
  const isLassoActive = useLassoStore(
    (s) => s.selectedStrokeIds.length > 0 || s.selectedItemIds.length > 0,
  )
  const showBackdrop = show && !isLassoActive && !isInsideSpace

  return (
    <AnimatePresence>
      {showBackdrop && (
        <motion.div
          key="selection-blur-canvas-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
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

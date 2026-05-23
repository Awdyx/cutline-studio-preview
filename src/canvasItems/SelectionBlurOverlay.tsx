import { AnimatePresence, motion } from 'framer-motion'
import { SELECTION_DEPTH_CLASS } from '../styles/tokens'
import { Z_SELECTION_DIM } from './canvasZOrder'
import { useCanvasItemsStore } from './canvasItemsStore'

/** Blurs the canvas behind selected items. */
export default function SelectionBlurOverlay() {
  const show = useCanvasItemsStore((s) => s.selectedIds.length > 0)

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="selection-blur"
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
            zIndex: Z_SELECTION_DIM,
            background: 'transparent',
            pointerEvents: 'none',
          }}
        />
      )}
    </AnimatePresence>
  )
}

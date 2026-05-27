import { useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLassoStore } from '../drawing/useLassoStore'
import { useStrokesStore } from '../drawing/strokesStore'
import { useCanvasItemsStore } from './canvasItemsStore'
import { Z_SELECTION_DIM } from './canvasZOrder'
import type { Stroke } from '../drawing/types'
import type { CanvasItem } from './types'

/**
 * How far (in canvas units) the blur gradient extends beyond the selection bounds.
 * This creates the soft feathered edge rather than a sharp cutoff.
 */
const GRADIENT_SIZE = 120

type Bounds = { left: number; top: number; width: number; height: number }

function computeCanvasBounds(
  selectedStrokeIds: string[],
  selectedItemIds: string[],
  strokes: readonly Stroke[],
  items: readonly CanvasItem[],
): Bounds | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  const strokeSet = new Set(selectedStrokeIds)
  for (const stroke of strokes) {
    if (!strokeSet.has(stroke.id)) continue
    for (const pt of stroke.points) {
      if (pt.x < minX) minX = pt.x
      if (pt.y < minY) minY = pt.y
      if (pt.x > maxX) maxX = pt.x
      if (pt.y > maxY) maxY = pt.y
    }
  }

  const itemSet = new Set(selectedItemIds)
  for (const item of items) {
    if (!itemSet.has(item.id)) continue
    if (item.x < minX) minX = item.x
    if (item.y < minY) minY = item.y
    if (item.x + item.width > maxX) maxX = item.x + item.width
    if (item.y + item.height > maxY) maxY = item.y + item.height
  }

  if (!isFinite(minX)) return null

  const left = minX - GRADIENT_SIZE
  const top = minY - GRADIENT_SIZE
  const width = maxX - minX + 2 * GRADIENT_SIZE
  const height = maxY - minY + 2 * GRADIENT_SIZE
  return { left, top, width, height }
}

function buildMask(bounds: Bounds): string {
  // Clamp gradient stops so they never exceed 50% (prevents overlap on small selections)
  const xPct = Math.min(49, (GRADIENT_SIZE / bounds.width) * 100).toFixed(1)
  const xEnd = (100 - parseFloat(xPct)).toFixed(1)
  const yPct = Math.min(49, (GRADIENT_SIZE / bounds.height) * 100).toFixed(1)
  const yEnd = (100 - parseFloat(yPct)).toFixed(1)
  const maskH = `linear-gradient(to right, transparent 0%, black ${xPct}%, black ${xEnd}%, transparent 100%)`
  const maskV = `linear-gradient(to bottom, transparent 0%, black ${yPct}%, black ${yEnd}%, transparent 100%)`
  return `${maskH}, ${maskV}`
}

/**
 * Lasso-specific selection blur: a soft, positioned backdrop-filter that only
 * covers the lasso selection bounds, fading out gently at the edges.
 * Replaces the full-canvas SelectionBlurOverlay when a lasso selection is active.
 */
export default function LassoSelectionBlur() {
  const selectedStrokeIds = useLassoStore((s) => s.selectedStrokeIds)
  const selectedItemIds = useLassoStore((s) => s.selectedItemIds)
  // Subscribe to dragOffset so the blur follows the selection live during drag
  const dragOffset = useLassoStore((s) => s.dragOffset)
  const strokes = useStrokesStore((s) => s.strokes)
  const items = useCanvasItemsStore((s) => s.items)

  const isLasso = selectedStrokeIds.length > 0 || selectedItemIds.length > 0
  // No blur when only strokes are selected — strokes are transparent and the blur looks odd
  const hasOnlyStrokes = selectedStrokeIds.length > 0 && selectedItemIds.length === 0

  const bounds = isLasso
    ? computeCanvasBounds(selectedStrokeIds, selectedItemIds, strokes, items)
    : null

  // Preserve last known bounds so the exit animation has a position to fade from
  const lastBoundsRef = useRef<Bounds | null>(null)
  if (bounds) lastBoundsRef.current = bounds
  const renderBounds = bounds ?? lastBoundsRef.current

  // Offset the blur by the live drag delta (canvas coords) so it tracks with items/strokes
  const dxCanvas = dragOffset && isLasso ? dragOffset.canvasDx : 0
  const dyCanvas = dragOffset && isLasso ? dragOffset.canvasDy : 0

  const mask = renderBounds ? buildMask(renderBounds) : undefined

  return (
    <AnimatePresence>
      {isLasso && !hasOnlyStrokes && renderBounds && (
        <motion.div
          key="lasso-selection-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          aria-hidden
          data-lock-flatten-skip
          style={{
            position: 'absolute',
            left: renderBounds.left + dxCanvas,
            top: renderBounds.top + dyCanvas,
            width: renderBounds.width,
            height: renderBounds.height,
            zIndex: Z_SELECTION_DIM,
            pointerEvents: 'none',
            backdropFilter: 'blur(7px)',
            WebkitBackdropFilter: 'blur(7px)',
            maskImage: mask,
            WebkitMaskImage: mask,
            // intersect both gradient layers so only the overlapping opaque region blurs
            maskComposite: 'intersect',
            WebkitMaskComposite: 'source-in',
          }}
        />
      )}
    </AnimatePresence>
  )
}

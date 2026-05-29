import type { RefObject } from 'react'
import { Z_SELECTION_ABOVE_DIM } from '../canvasItems/canvasZOrder'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { lassoSelectionChromeCanvasRect } from './lassoGeometry'
import { useLassoSelectionDrag } from './useLassoSelectionDrag'
import { useLassoStore } from './useLassoStore'
import { useStrokesStore } from './strokesStore'

/** Above selected items so the padded drag handle receives pointer events. */
const Z_LASSO_SELECTION_CHROME = Z_SELECTION_ABOVE_DIM + 50

type Props = {
  canvasRef: RefObject<HTMLDivElement | null>
}

/**
 * Canvas-space lasso selection box — moves with pan/zoom and supports
 * click-drag anywhere inside the padded bounds (original shipped behaviour).
 */
export default function LassoSelectionChrome({ canvasRef }: Props) {
  const selectedStrokeIds = useLassoStore((s) => s.selectedStrokeIds)
  const selectedItemIds = useLassoStore((s) => s.selectedItemIds)
  const dragOffset = useLassoStore((s) => s.dragOffset)
  const strokes = useStrokesStore((s) => s.strokes)
  const items = useCanvasItemsStore((s) => s.items)

  const selectedStrokes = strokes.filter((s) => selectedStrokeIds.includes(s.id))
  const selectedCanvasItems = items.filter((item) => selectedItemIds.includes(item.id))
  const hasSelection = selectedStrokeIds.length > 0 || selectedItemIds.length > 0

  const chromeRect = hasSelection
    ? lassoSelectionChromeCanvasRect(selectedStrokes, selectedCanvasItems, dragOffset)
    : null

  const { onDragPointerDown, onDragPointerMove, onDragPointerUp, isDragging } =
    useLassoSelectionDrag(canvasRef)

  if (!chromeRect || chromeRect.width <= 0 || chromeRect.height <= 0) return null

  return (
    <div
      data-lasso-selection=""
      className="lasso-selection-pane"
      data-lock-flatten-skip
      onPointerDown={onDragPointerDown}
      onPointerMove={onDragPointerMove}
      onPointerUp={onDragPointerUp}
      style={{
        position: 'absolute',
        left: chromeRect.left,
        top: chromeRect.top,
        width: chromeRect.width,
        height: chromeRect.height,
        border: '1.5px dashed var(--lasso-selection-border)',
        borderRadius: 18,
        cursor: isDragging.current ? 'grabbing' : 'grab',
        zIndex: Z_LASSO_SELECTION_CHROME,
        pointerEvents: 'auto',
        touchAction: 'none',
      }}
    />
  )
}

import { useEffect, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { isCanvasItemVisibleInViewport } from '../canvasItems/canvasItemViewportVisibility'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { useCanvasItemDragStore } from '../canvasItems/canvasItemDragStore'
import { useCanvasItemResizeStore } from '../canvasItems/canvasItemResizeStore'
import { useLassoStore } from '../drawing/useLassoStore'

export const SELECTION_VIEWPORT_RESELECT_MS = 5000

/**
 * Deselects a sole-selected item once it leaves the viewport; restores selection
 * if it returns within {@link SELECTION_VIEWPORT_RESELECT_MS}.
 */
export function useCanvasSelectionViewportPark(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  disabled = false,
) {
  useEffect(() => {
    if (disabled) return

    let frame = 0

    function tick() {
      void transformRef.current

      const dragActive = useCanvasItemDragStore.getState().activeItemId != null
      const resizing = useCanvasItemResizeStore.getState().activeItemId != null
      const lasso = useLassoStore.getState()
      const lassoActive =
        lasso.selectedStrokeIds.length > 0 || lasso.selectedItemIds.length > 0

      if (!dragActive && !resizing && !lassoActive) {
        const store = useCanvasItemsStore.getState()
        const { selectedIds, viewportSelectionPark } = store

        if (selectedIds.length === 1) {
          if (!isCanvasItemVisibleInViewport(selectedIds[0])) {
            store.parkSelectionOffScreen()
          }
        } else if (viewportSelectionPark) {
          const elapsed = Date.now() - viewportSelectionPark.leftViewportAt
          const parkedId = viewportSelectionPark.itemIds[0]
          if (elapsed >= SELECTION_VIEWPORT_RESELECT_MS) {
            store.clearViewportSelectionPark()
          } else if (parkedId && isCanvasItemVisibleInViewport(parkedId)) {
            store.restoreViewportParkedSelection()
          }
        }
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [disabled, transformRef])
}

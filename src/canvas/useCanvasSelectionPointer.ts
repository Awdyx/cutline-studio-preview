import { useCallback } from 'react'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { isPointerOnSelectedItem } from './canvasSelectionDismiss'
import { useCanvasNavigationStore } from './canvasNavigationStore'
import { useDeferredCanvasTap } from './useDeferredCanvasTap'

/**
 * When an item is selected, a tap anywhere outside it clears selection.
 * Empty canvas and other objects both count as "outside".
 */
export function useCanvasSelectionPointer() {
  const outsideDismissTap = useDeferredCanvasTap((event) => {
    if (useCanvasNavigationStore.getState().shouldSuppressBackgroundSelectionClear()) {
      return
    }

    const selectedIds = useCanvasItemsStore.getState().selectedIds
    if (selectedIds.length === 0) return
    if (isPointerOnSelectedItem(event.target, selectedIds)) return

    useCanvasItemsStore.getState().clearSelection()
  })

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'pen') return

      const selectedIds = useCanvasItemsStore.getState().selectedIds
      if (selectedIds.length === 0) return
      if (isPointerOnSelectedItem(event.target, selectedIds)) return

      outsideDismissTap.onPointerDown(event)
    },
    [outsideDismissTap],
  )

  return {
    onPointerDown,
    onPointerMove: outsideDismissTap.onPointerMove,
    onPointerUp: outsideDismissTap.onPointerUp,
    onPointerCancel: outsideDismissTap.onPointerCancel,
  }
}

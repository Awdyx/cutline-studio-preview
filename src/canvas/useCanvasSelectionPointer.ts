import { useCallback } from 'react'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import {
  isPointerOnSelectedItem,
  isPointerOnSpacePreview,
} from './canvasSelectionDismiss'
import { useCanvasNavigationStore } from './canvasNavigationStore'
import { useDeferredCanvasTap } from './useDeferredCanvasTap'

/**
 * When an item is selected, a tap anywhere outside it clears selection.
 * Empty canvas and other objects both count as "outside".
 */
export function useCanvasSelectionPointer() {
  const previewAdjustDismissTap = useDeferredCanvasTap((event) => {
    if (useCanvasNavigationStore.getState().shouldSuppressBackgroundSelectionClear()) {
      return
    }

    const adjustId = useCanvasItemsStore.getState().previewAdjustSpaceId
    if (!adjustId) return
    if (isPointerOnSpacePreview(event.target, adjustId)) return

    useCanvasItemsStore.getState().setPreviewAdjustSpace(null)
  })

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

      const adjustId = useCanvasItemsStore.getState().previewAdjustSpaceId
      if (adjustId) {
        if (!isPointerOnSpacePreview(event.target, adjustId)) {
          previewAdjustDismissTap.onPointerDown(event)
        }
      }

      const selectedIds = useCanvasItemsStore.getState().selectedIds
      if (selectedIds.length === 0) return
      if (isPointerOnSelectedItem(event.target, selectedIds)) return

      outsideDismissTap.onPointerDown(event)
    },
    [outsideDismissTap, previewAdjustDismissTap],
  )

  return {
    onPointerDown,
    onPointerMove: () => {
      previewAdjustDismissTap.onPointerMove()
      outsideDismissTap.onPointerMove()
    },
    onPointerUp: () => {
      previewAdjustDismissTap.onPointerUp()
      outsideDismissTap.onPointerUp()
    },
    onPointerCancel: () => {
      previewAdjustDismissTap.onPointerCancel()
      outsideDismissTap.onPointerCancel()
    },
  }
}

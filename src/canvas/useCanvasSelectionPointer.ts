import { useCallback, useEffect, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import {
  dismissStudyHubMenuFocus,
  isPointerOnCanvasViewport,
  isPointerOnStudyHubMenuFocusPortal,
  isStudyHubMenuFocusActive,
} from '../canvasItems/studyHubMenuFocus'
import {
  dismissCanvasSelection,
  isPointerOnCanvasItem,
  isPointerOnSpacePreview,
  shouldDismissSelectionForPointer,
} from './canvasSelectionDismiss'
import { useCanvasNavigationStore } from './canvasNavigationStore'
import { watchPendingTouchTap } from './pointerTapGesture'

/**
 * When an item is selected, a tap anywhere on the canvas viewport clears selection.
 * Empty canvas, other objects, and space previews all dismiss without activating.
 */
export function useCanvasSelectionPointer(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
) {
  const studyHubMenuFocusActive = useCanvasItemsStore(
    (s) => s.menuFocusReturnCamera != null,
  )

  useEffect(() => {
    if (!studyHubMenuFocusActive) return

    function onPointerDown(event: PointerEvent) {
      if (event.pointerType === 'pen') return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      if (
        useCanvasNavigationStore.getState().shouldSuppressBackgroundSelectionClear()
      ) {
        return
      }
      if (isPointerOnStudyHubMenuFocusPortal(event.target)) return
      if (!isPointerOnCanvasViewport(event.target)) return

      event.preventDefault()
      event.stopPropagation()
      dismissStudyHubMenuFocus(transformRef.current)
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [studyHubMenuFocusActive, transformRef])

  useEffect(() => {
    let touchCancel: (() => void) | null = null

    function clearTouchWatch() {
      touchCancel?.()
      touchCancel = null
    }

    function runOutsideTap(event: PointerEvent) {
      if (
        useCanvasNavigationStore.getState().shouldSuppressBackgroundSelectionClear()
      ) {
        return
      }
      if (useCanvasNavigationStore.getState().shouldSuppressItemTap()) return
      if (isStudyHubMenuFocusActive()) return
      if (!isPointerOnCanvasViewport(event.target)) return

      const adjustId = useCanvasItemsStore.getState().previewAdjustSpaceId
      if (adjustId && !isPointerOnSpacePreview(event.target, adjustId)) {
        useCanvasItemsStore.getState().setPreviewAdjustSpace(null)
      }

      const selectedIds = useCanvasItemsStore.getState().selectedIds
      if (!shouldDismissSelectionForPointer(event.target, selectedIds)) return

      dismissCanvasSelection()

      // Block enter-space / select / study-hub focus — dismiss only.
      if (isPointerOnCanvasItem(event.target)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (event.pointerType === 'pen') return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      if (isStudyHubMenuFocusActive()) return

      clearTouchWatch()

      if (event.pointerType === 'mouse') {
        runOutsideTap(event)
        return
      }

      if (event.pointerType !== 'touch') return

      touchCancel = watchPendingTouchTap({
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        onComplete: () => {
          touchCancel = null
          runOutsideTap(event)
        },
        onCancel: clearTouchWatch,
      })
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      clearTouchWatch()
    }
  }, [])

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'pen') return

      if (isStudyHubMenuFocusActive()) {
        if (
          isPointerOnCanvasViewport(event.target) &&
          !isPointerOnStudyHubMenuFocusPortal(event.target)
        ) {
          if (event.pointerType === 'mouse' && event.button !== 0) return
          event.preventDefault()
          event.stopPropagation()
          dismissStudyHubMenuFocus(transformRef.current)
        }
      }
    },
    [transformRef],
  )

  return {
    onPointerDown,
    onPointerMove: () => {},
    onPointerUp: () => {},
    onPointerCancel: () => {},
  }
}

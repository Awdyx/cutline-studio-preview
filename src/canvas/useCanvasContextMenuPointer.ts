import { useCallback, useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { clientToCanvas } from '../drawing/canvasCoords'
import { canvasEditingAllowed } from '../canvasEdit/layer'
import { isPenInput } from '../drawing/penInput'
import { playSound } from '../sound/playSound'
import { isStudyHubMenuFocusActive } from '../canvasItems/studyHubMenuFocus'
import { isPointerOnCanvasItem } from './canvasSelectionDismiss'
import { useCanvasContextMenuStore } from './canvasContextMenuStore'

/** Surfaces where double-click opens the canvas quick-add menu. */
function isCanvasQuickMenuPointerSurface(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (target.closest('.cutline-draw-target')) return true
  return isStudyHubFocusQuickMenuSurface(target)
}

function isPenOriginatedDoubleClick(
  event: MouseEvent,
  lastPointerDownWasPen: boolean,
): boolean {
  const pointerType = (event as MouseEvent & { pointerType?: string }).pointerType
  if (pointerType === 'pen') return true
  return lastPointerDownWasPen
}

/** Dimmed backdrop / portal void — not the focused hub panel or scratch pad. */
function isStudyHubFocusQuickMenuSurface(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (target.closest('[data-canvas-context-menu]')) return false
  if (target.closest('[data-study-hub-menu-focus-blocker]')) return true
  if (!target.closest('.study-hub-menu-focus-portal')) return false
  if (target.closest('.study-hub-menu-focus-frame__hub')) return false
  if (target.closest('.study-hub-menu-focus-frame__controls')) return false
  if (target.closest('[data-study-hub-scratch-pad], [data-study-hub-scratch-pad-viewport]')) {
    return false
  }
  if (target.closest('[data-study-hub-scratch-split]')) return false
  return true
}

export function useCanvasContextMenuPointer(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  canvasRef: RefObject<HTMLDivElement | null>,
) {
  const lastPointerDownWasPenRef = useRef(false)

  const tryOpenMenu = useCallback(
    (clientX: number, clientY: number, target: EventTarget | null) => {
      if (!canvasEditingAllowed()) return
      if (isPointerOnCanvasItem(target)) return
      if (target instanceof Element && target.closest('[data-canvas-context-menu]')) {
        return
      }

      const canvasPoint = clientToCanvas(
        clientX,
        clientY,
        transformRef,
        canvasRef.current,
      )
      if (!canvasPoint) return

      playSound('menuOpen')
      useCanvasContextMenuStore.getState().openAt(
        clientX,
        clientY,
        canvasPoint.x,
        canvasPoint.y,
      )
    },
    [canvasRef, transformRef],
  )

  const onContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault()
      tryOpenMenu(event.clientX, event.clientY, event.target)
    },
    [tryOpenMenu],
  )

  const onDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (
        isPenOriginatedDoubleClick(
          event.nativeEvent,
          lastPointerDownWasPenRef.current,
        )
      ) {
        return
      }
      tryOpenMenu(event.clientX, event.clientY, event.target)
    },
    [tryOpenMenu],
  )

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!isCanvasQuickMenuPointerSurface(event.target)) return
      lastPointerDownWasPenRef.current = isPenInput(event)
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [])

  useEffect(() => {
    function onStudyFocusContextMenu(event: MouseEvent) {
      if (!isStudyHubMenuFocusActive()) return
      if (!isStudyHubFocusQuickMenuSurface(event.target)) return
      event.preventDefault()
      tryOpenMenu(event.clientX, event.clientY, event.target)
    }

    function onStudyFocusDoubleClick(event: MouseEvent) {
      if (!isStudyHubMenuFocusActive()) return
      if (!isStudyHubFocusQuickMenuSurface(event.target)) return
      if (
        isPenOriginatedDoubleClick(
          event,
          lastPointerDownWasPenRef.current,
        )
      ) {
        return
      }
      tryOpenMenu(event.clientX, event.clientY, event.target)
    }

    document.addEventListener('contextmenu', onStudyFocusContextMenu, true)
    document.addEventListener('dblclick', onStudyFocusDoubleClick, true)
    return () => {
      document.removeEventListener('contextmenu', onStudyFocusContextMenu, true)
      document.removeEventListener('dblclick', onStudyFocusDoubleClick, true)
    }
  }, [tryOpenMenu])

  return { onContextMenu, onDoubleClick }
}

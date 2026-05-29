import { useCallback } from 'react'
import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { clientToCanvas } from '../drawing/canvasCoords'
import { canvasEditingAllowed } from '../canvasEdit/layer'
import { playSound } from '../sound/playSound'
import { isPointerOnCanvasItem } from './canvasSelectionDismiss'
import { useCanvasContextMenuStore } from './canvasContextMenuStore'
import { useCanvasFisheyeStore } from './canvasFisheyeStore'

export function useCanvasContextMenuPointer(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  canvasRef: RefObject<HTMLDivElement | null>,
) {
  const tryOpenMenu = useCallback(
    (clientX: number, clientY: number, target: EventTarget | null) => {
      if (useCanvasFisheyeStore.getState().engaged) return
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
      tryOpenMenu(event.clientX, event.clientY, event.target)
    },
    [tryOpenMenu],
  )

  return { onContextMenu, onDoubleClick }
}

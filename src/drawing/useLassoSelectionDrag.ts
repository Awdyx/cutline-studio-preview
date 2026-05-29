import { useRef, useEffect, type RefObject } from 'react'
import { pushUndoSnapshot } from '../canvasHistory/canvasHistory'
import { lassoMoveKeepsStudioCentre } from '../canvas/studioCentre'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { isImageInSticky } from '../canvasItems/types'
import { playSound } from '../sound/playSound'
import {
  startItemDragSound,
  stopItemDragSound,
  updateItemDragSound,
} from '../sound/itemDragSound'
import { animateLassoDragRebound } from './lassoDragRebound'
import { useLassoStore } from './useLassoStore'
import { useStrokesStore } from './strokesStore'

import { screenDeltaToLogicalCanvas } from './canvasCoords'

function setLassoDragActive(active: boolean) {
  if (active) {
    document.documentElement.setAttribute('data-canvas-lasso-dragging', '')
  } else {
    document.documentElement.removeAttribute('data-canvas-lasso-dragging')
  }
}

export function useLassoSelectionDrag(canvasRef: RefObject<HTMLDivElement | null>) {
  const isDragging = useRef(false)
  const lastDragPos = useRef<{ x: number; y: number } | null>(null)
  const didDrag = useRef(false)
  const totalCanvasDelta = useRef({ dx: 0, dy: 0 })
  const dragSoundActive = useRef(false)

  const beginLassoDragSound = () => {
    if (dragSoundActive.current) return
    dragSoundActive.current = true
    playSound('itemGrab')
    startItemDragSound()
  }

  const endLassoDragSound = (moved: boolean) => {
    if (!dragSoundActive.current) return
    dragSoundActive.current = false
    stopItemDragSound()
    if (moved) playSound('itemDrop')
  }

  const onDragPointerDown = (e: React.PointerEvent) => {
    const canvasEl = canvasRef.current
    const { selectedStrokeIds, selectedItemIds } = useLassoStore.getState()
    const hasSelection = selectedStrokeIds.length > 0 || selectedItemIds.length > 0
    if (!hasSelection || !canvasEl) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    isDragging.current = true
    didDrag.current = false
    lastDragPos.current = { x: e.clientX, y: e.clientY }
    totalCanvasDelta.current = { dx: 0, dy: 0 }
    pushUndoSnapshot()
    setLassoDragActive(true)
    useLassoStore.getState().setDragOffset({
      canvasDx: 0,
      canvasDy: 0,
      ids: selectedStrokeIds,
    })
  }

  const onDragPointerMove = (e: React.PointerEvent) => {
    const canvasEl = canvasRef.current
    if (!isDragging.current || !lastDragPos.current || !canvasEl) return
    e.preventDefault()
    e.stopPropagation()

    const screenDx = e.clientX - lastDragPos.current.x
    const screenDy = e.clientY - lastDragPos.current.y
    lastDragPos.current = { x: e.clientX, y: e.clientY }
    if (Math.abs(screenDx) < 0.5 && Math.abs(screenDy) < 0.5) return

    didDrag.current = true
    beginLassoDragSound()
    updateItemDragSound(e.clientX, e.clientY)
    const { dx, dy } = screenDeltaToLogicalCanvas(screenDx, screenDy, canvasEl)
    totalCanvasDelta.current.dx += dx
    totalCanvasDelta.current.dy += dy

    const { selectedStrokeIds, dragOffset } = useLassoStore.getState()
    useLassoStore.getState().setDragOffset({
      canvasDx: (dragOffset?.canvasDx ?? 0) + dx,
      canvasDy: (dragOffset?.canvasDy ?? 0) + dy,
      ids: selectedStrokeIds,
    })
  }

  const onDragPointerUp = (e: React.PointerEvent) => {
    e.stopPropagation()
    isDragging.current = false
    lastDragPos.current = null
    const moved = didDrag.current

    const { selectedStrokeIds, selectedItemIds } = useLassoStore.getState()
    const { moveStrokes } = useStrokesStore.getState()

    endLassoDragSound(
      moved &&
        lassoMoveKeepsStudioCentre(
          selectedStrokeIds,
          selectedItemIds,
          totalCanvasDelta.current.dx,
          totalCanvasDelta.current.dy,
        ),
    )

    setLassoDragActive(false)

    if (!moved) {
      useLassoStore.getState().setDragOffset(null)
      return
    }

    const { dx, dy } = totalCanvasDelta.current
    if (!lassoMoveKeepsStudioCentre(selectedStrokeIds, selectedItemIds, dx, dy)) {
      animateLassoDragRebound(selectedStrokeIds)
      return
    }

    if (selectedStrokeIds.length > 0) moveStrokes(selectedStrokeIds, dx, dy)
    if (selectedItemIds.length > 0) {
      const { items, updateItemPosition } = useCanvasItemsStore.getState()
      const selectedSet = new Set(selectedItemIds)
      for (const id of selectedItemIds) {
        const item = items.find((i) => i.id === id)
        if (!item) continue
        if (
          isImageInSticky(item) &&
          item.stickyId &&
          selectedSet.has(item.stickyId)
        ) {
          continue
        }
        updateItemPosition(id, item.x + dx, item.y + dy)
      }
    }
    useLassoStore.getState().setDragOffset(null)
  }

  useEffect(
    () => () => {
      if (isDragging.current) setLassoDragActive(false)
    },
    [],
  )

  return {
    onDragPointerDown,
    onDragPointerMove,
    onDragPointerUp,
    isDragging,
  }
}

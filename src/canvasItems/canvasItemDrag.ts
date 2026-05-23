import type { PointerEvent as ReactPointerEvent } from 'react'
import { useCanvasNavigationStore } from '../canvas/canvasNavigationStore'
import { clientToCanvasFromElement } from '../drawing/canvasCoords'
import { playSound } from '../sound/playSound'
import {
  startItemDragSound,
  stopItemDragSound,
  updateItemDragSound,
} from '../sound/itemDragSound'
import { useCanvasItemDragStore } from './canvasItemDragStore'
import { useCanvasItemsStore } from './canvasItemsStore'

const DRAG_THRESHOLD_PX = 8
const DRAG_ACTIVE_CLASS = 'canvas-item-drag-active'

type DragPhase = 'pending' | 'dragging'

type DragSession = {
  itemId: string
  pointerId: number
  phase: DragPhase
  canvasEl: HTMLElement
  grabOffsetX: number
  grabOffsetY: number
  startClientX: number
  startClientY: number
  onReleaseWithoutDrag?: () => void
}

let session: DragSession | null = null
let detachListeners: (() => void) | null = null

function screenDist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1)
}

function resolveCanvasEl(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  const canvas = target.closest('.cutline-draw-target')
  return canvas instanceof HTMLElement ? canvas : null
}

function setDragActiveClass(active: boolean) {
  document.documentElement.classList.toggle(DRAG_ACTIVE_CLASS, active)
}

function clearActiveItem() {
  useCanvasItemDragStore.setState({ activeItemId: null })
}

function removeDocumentListeners() {
  detachListeners?.()
  detachListeners = null
}

function commitDragStart() {
  if (!session || session.phase === 'dragging') return

  session.phase = 'dragging'
  const store = useCanvasItemsStore.getState()
  store.beginItemDrag(session.itemId)
  store.raiseInPlane(session.itemId)
  playSound('itemGrab')
  startItemDragSound()
  useCanvasItemDragStore.setState({ activeItemId: session.itemId })
  setDragActiveClass(true)
}

function finishSession() {
  const ended = session
  removeDocumentListeners()
  session = null
  setDragActiveClass(false)
  clearActiveItem()

  if (!ended) return

  if (ended.phase === 'pending') {
    ended.onReleaseWithoutDrag?.()
    return
  }

  stopItemDragSound()
  playSound('itemDrop')
}

function applyDragPosition(clientX: number, clientY: number) {
  if (!session || session.phase !== 'dragging') return

  updateItemDragSound(clientX, clientY)

  const pos = clientToCanvasFromElement(clientX, clientY, session.canvasEl)
  if (!pos) return

  useCanvasItemsStore.getState().updateItemPosition(
    session.itemId,
    pos.x - session.grabOffsetX,
    pos.y - session.grabOffsetY,
  )
}

/**
 * Start tracking a grab-handle pointer. Document-level capture listeners only —
 * no setPointerCapture on the handle (DOM updates during move used to drop capture).
 */
export function attachCanvasItemDragPointerDown(
  itemId: string,
  event: ReactPointerEvent<HTMLElement>,
  options?: { onReleaseWithoutDrag?: () => void },
) {
  if (event.pointerType === 'pen') return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  if (
    event.pointerType === 'touch' &&
    useCanvasNavigationStore.getState().shouldSuppressHandleGesture()
  ) {
    return
  }

  const canvasEl = resolveCanvasEl(event.currentTarget)
  if (!canvasEl) return

  const items = useCanvasItemsStore.getState().items
  const item = items.find((entry) => entry.id === itemId)
  if (!item) return

  const pointerCanvas = clientToCanvasFromElement(
    event.clientX,
    event.clientY,
    canvasEl,
  )
  if (!pointerCanvas) return

  finishSession()

  event.preventDefault()
  event.stopPropagation()

  const pointerId = event.pointerId

  session = {
    itemId,
    pointerId,
    phase: 'pending',
    canvasEl,
    grabOffsetX: pointerCanvas.x - item.x,
    grabOffsetY: pointerCanvas.y - item.y,
    startClientX: event.clientX,
    startClientY: event.clientY,
    onReleaseWithoutDrag: options?.onReleaseWithoutDrag,
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!session || e.pointerId !== pointerId) return

    if (useCanvasNavigationStore.getState().shouldSuppressHandleGesture()) {
      finishSession()
      return
    }

    if (session.phase === 'pending') {
      if (
        screenDist(e.clientX, e.clientY, session.startClientX, session.startClientY) <
        DRAG_THRESHOLD_PX
      ) {
        return
      }
      commitDragStart()
    }

    if (e.cancelable) e.preventDefault()
    applyDragPosition(e.clientX, e.clientY)
  }

  const onPointerEnd = (e: PointerEvent) => {
    if (!session || e.pointerId !== pointerId) return
    finishSession()
  }

  document.addEventListener('pointermove', onPointerMove, { capture: true })
  document.addEventListener('pointerup', onPointerEnd, { capture: true })
  document.addEventListener('pointercancel', onPointerEnd, { capture: true })

  detachListeners = () => {
    document.removeEventListener('pointermove', onPointerMove, true)
    document.removeEventListener('pointerup', onPointerEnd, true)
    document.removeEventListener('pointercancel', onPointerEnd, true)
  }
}

export function cancelCanvasItemDrag() {
  finishSession()
}

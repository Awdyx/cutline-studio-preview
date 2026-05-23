import {
  useCallback,
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { useCanvasNavigationStore } from '../canvas/canvasNavigationStore'
import {
  startItemResizeSound,
  stopItemResizeSound,
  updateItemResizeSound,
} from '../sound/itemResizeSound'
import { MIN_ITEM_HEIGHT, MIN_ITEM_WIDTH } from './grabZone'
import { useCanvasItemsStore } from './canvasItemsStore'

const RESIZE_THRESHOLD_PX = 8

type ResizePhase = 'idle' | 'pending' | 'active'

type ResizeSession = {
  itemId: string
  pointerId: number
  phase: ResizePhase
  startClientX: number
  startClientY: number
  startWidth: number
  startHeight: number
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  setResizing: (resizing: boolean) => void
}

let resizeSession: ResizeSession | null = null
let detachResizeListeners: (() => void) | null = null

function screenDist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1)
}

function removeResizeListeners() {
  detachResizeListeners?.()
  detachResizeListeners = null
}

function finishResizeSession() {
  const ended = resizeSession
  removeResizeListeners()
  resizeSession = null

  if (!ended) return

  if (ended.phase === 'active') {
    stopItemResizeSound()
    ended.setResizing(false)
  }
}

export function cancelCanvasItemResize() {
  finishResizeSession()
}

function commitResizeStart() {
  if (!resizeSession || resizeSession.phase !== 'pending') return

  resizeSession.phase = 'active'
  useCanvasItemsStore.getState().beginItemResize(resizeSession.itemId)
  resizeSession.setResizing(true)
  startItemResizeSound(resizeSession.startClientX, resizeSession.startClientY)
}

function applyResizeMove(clientX: number, clientY: number) {
  if (!resizeSession || resizeSession.phase !== 'active') return

  updateItemResizeSound(clientX, clientY)

  const ref = resizeSession.transformRef.current
  if (!ref) return
  const scale = ref.state.scale

  const dx = (clientX - resizeSession.startClientX) / scale
  const dy = (clientY - resizeSession.startClientY) / scale

  const nextWidth = Math.max(MIN_ITEM_WIDTH, resizeSession.startWidth + dx)
  const nextHeight = Math.max(MIN_ITEM_HEIGHT, resizeSession.startHeight + dy)

  useCanvasItemsStore
    .getState()
    .updateItemSize(resizeSession.itemId, nextWidth, nextHeight)
}

function attachResizePointerSession(
  itemId: string,
  event: ReactPointerEvent<HTMLButtonElement>,
  width: number,
  height: number,
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  setResizing: (resizing: boolean) => void,
  touchDeferred: boolean,
) {
  finishResizeSession()

  event.preventDefault()
  event.stopPropagation()

  const pointerId = event.pointerId

  resizeSession = {
    itemId,
    pointerId,
    phase: touchDeferred ? 'pending' : 'active',
    startClientX: event.clientX,
    startClientY: event.clientY,
    startWidth: width,
    startHeight: height,
    transformRef,
    setResizing,
  }

  if (!touchDeferred) {
    useCanvasItemsStore.getState().beginItemResize(itemId)
    setResizing(true)
    startItemResizeSound(event.clientX, event.clientY)
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!resizeSession || e.pointerId !== pointerId) return

    if (useCanvasNavigationStore.getState().shouldSuppressHandleGesture()) {
      finishResizeSession()
      return
    }

    if (resizeSession.phase === 'pending') {
      if (
        screenDist(
          e.clientX,
          e.clientY,
          resizeSession.startClientX,
          resizeSession.startClientY,
        ) < RESIZE_THRESHOLD_PX
      ) {
        return
      }
      commitResizeStart()
    }

    if (e.cancelable) e.preventDefault()
    applyResizeMove(e.clientX, e.clientY)
  }

  const onPointerEnd = (e: PointerEvent) => {
    if (!resizeSession || e.pointerId !== pointerId) return
    finishResizeSession()
  }

  document.addEventListener('pointermove', onPointerMove, { capture: true })
  document.addEventListener('pointerup', onPointerEnd, { capture: true })
  document.addEventListener('pointercancel', onPointerEnd, { capture: true })

  detachResizeListeners = () => {
    document.removeEventListener('pointermove', onPointerMove, true)
    document.removeEventListener('pointerup', onPointerEnd, true)
    document.removeEventListener('pointercancel', onPointerEnd, true)
  }
}

export function useCanvasItemResize(
  itemId: string,
  width: number,
  height: number,
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  onResizeStateChange?: (resizing: boolean) => void,
) {
  const [isResizing, setIsResizing] = useState(false)

  const setResizing = useCallback(
    (resizing: boolean) => {
      setIsResizing(resizing)
      onResizeStateChange?.(resizing)
    },
    [onResizeStateChange],
  )

  useEffect(
    () => () => {
      if (resizeSession?.itemId === itemId) {
        finishResizeSession()
      }
    },
    [itemId],
  )

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === 'pen') return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      if (
        event.pointerType === 'touch' &&
        useCanvasNavigationStore.getState().shouldSuppressHandleGesture()
      ) {
        return
      }

      attachResizePointerSession(
        itemId,
        event,
        width,
        height,
        transformRef,
        setResizing,
        event.pointerType === 'touch',
      )
    },
    [height, itemId, setResizing, transformRef, width],
  )

  return {
    isResizing,
    handlePointerDown,
  }
}

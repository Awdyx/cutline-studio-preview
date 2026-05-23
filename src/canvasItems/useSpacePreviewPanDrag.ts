import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import { pushUndoSnapshot } from '../canvasHistory/canvasHistory'
import {
  clampSpacePreviewPan,
  resolveSpacePreviewPan,
  screenDeltaToPreviewPanDelta,
  zoomSpacePreviewPan,
  type SpacePreviewPan,
} from '../spaces/spacePreviewPan'
import { useCanvasItemsStore } from './canvasItemsStore'
import type { SpaceCanvasItem } from './types'

const WHEEL_ZOOM_SENSITIVITY = 0.0018
const WHEEL_UNDO_IDLE_MS = 400

export function useSpacePreviewPanDrag(
  item: SpaceCanvasItem,
  previewRef: RefObject<HTMLElement | null>,
  isAdjusting: boolean,
) {
  const [isPanDragging, setIsPanDragging] = useState(false)
  const dragRef = useRef<{
    pointerId: number
    startPan: SpacePreviewPan
    startX: number
    startY: number
  } | null>(null)
  const wheelUndoPendingRef = useRef(false)
  const wheelUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pinchRef = useRef<{
    startDistance: number
    startScale: number
  } | null>(null)

  const readLivePreview = useCallback((): SpacePreviewPan | null => {
    const spaceItem = useCanvasItemsStore
      .getState()
      .items.find(
        (entry): entry is SpaceCanvasItem =>
          entry.id === item.id && entry.type === 'space',
      )
    if (!spaceItem) return null
    return resolveSpacePreviewPan(spaceItem.previewPan)
  }, [item.id])

  const readPreviewSize = useCallback(() => {
    const el = previewRef.current
    if (!el) return null
    const { width, height } = el.getBoundingClientRect()
    if (width <= 0 || height <= 0) return null
    return { width, height }
  }, [previewRef])

  const updatePreview = useCallback(
    (next: SpacePreviewPan) => {
      const size = readPreviewSize()
      if (!size) return
      useCanvasItemsStore
        .getState()
        .updateSpacePreviewPan(
          item.id,
          clampSpacePreviewPan(next, size.width, size.height),
        )
    },
    [item.id, readPreviewSize],
  )

  const notePreviewAdjustUndo = useCallback(() => {
    if (wheelUndoPendingRef.current) return
    pushUndoSnapshot()
    wheelUndoPendingRef.current = true
    if (wheelUndoTimerRef.current) clearTimeout(wheelUndoTimerRef.current)
    wheelUndoTimerRef.current = setTimeout(() => {
      wheelUndoPendingRef.current = false
      wheelUndoTimerRef.current = null
    }, WHEEL_UNDO_IDLE_MS)
  }, [])

  const onPreviewAdjustPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      if (!isAdjusting || event.pointerType === 'pen') return
      if (pinchRef.current) return
      event.stopPropagation()
      event.preventDefault()
      pushUndoSnapshot()
      setIsPanDragging(true)
      dragRef.current = {
        pointerId: event.pointerId,
        startPan: resolveSpacePreviewPan(item.previewPan),
        startX: event.clientX,
        startY: event.clientY,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [isAdjusting, item.previewPan],
  )

  const onPreviewAdjustPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      if (pinchRef.current) return
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      event.stopPropagation()

      const size = readPreviewSize()
      if (!size) return

      const delta = screenDeltaToPreviewPanDelta(
        event.clientX - drag.startX,
        event.clientY - drag.startY,
        size.width,
        size.height,
        drag.startPan.scale,
      )
      updatePreview({
        x: drag.startPan.x + delta.x,
        y: drag.startPan.y + delta.y,
        scale: drag.startPan.scale,
      })
    },
    [readPreviewSize, updatePreview],
  )

  const endPreviewAdjustDrag = useCallback(
    (event: ReactPointerEvent) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      dragRef.current = null
      setIsPanDragging(false)
      try {
        event.currentTarget.releasePointerCapture(event.pointerId)
      } catch {
        // ignore
      }
    },
    [],
  )

  useEffect(() => {
    const el = previewRef.current
    if (!isAdjusting || !el) return

    function touchSpan(event: TouchEvent): number | null {
      if (event.touches.length < 2) return null
      const a = event.touches[0]
      const b = event.touches[1]
      return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY)
    }

    function touchMidpoint(event: TouchEvent, rect: DOMRect) {
      const a = event.touches[0]
      const b = event.touches[1]
      return {
        x: (a.clientX + b.clientX) / 2 - rect.left,
        y: (a.clientY + b.clientY) / 2 - rect.top,
      }
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault()
      event.stopPropagation()
      notePreviewAdjustUndo()

      const rect = el!.getBoundingClientRect()
      const size = readPreviewSize()
      if (!size) return

      const current = readLivePreview()
      if (!current) return

      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top
      const factor = Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY)
      updatePreview(
        zoomSpacePreviewPan(
          current,
          current.scale * factor,
          pointerX,
          pointerY,
          size.width,
          size.height,
        ),
      )
    }

    function onTouchStart(event: TouchEvent) {
      if (event.touches.length < 2) return
      event.stopPropagation()

      const distance = touchSpan(event)
      if (!distance) return

      const current = readLivePreview()
      if (!current) return

      pushUndoSnapshot()
      dragRef.current = null
      setIsPanDragging(false)
      pinchRef.current = {
        startDistance: distance,
        startScale: current.scale,
      }
    }

    function onTouchMove(event: TouchEvent) {
      const pinch = pinchRef.current
      if (!pinch || event.touches.length < 2) return
      event.preventDefault()
      event.stopPropagation()

      const distance = touchSpan(event)
      if (!distance) return

      const rect = el!.getBoundingClientRect()
      const size = readPreviewSize()
      if (!size) return

      const current = readLivePreview()
      if (!current) return

      const midpoint = touchMidpoint(event, rect)
      const nextScale = pinch.startScale * (distance / pinch.startDistance)
      updatePreview(
        zoomSpacePreviewPan(
          current,
          nextScale,
          midpoint.x,
          midpoint.y,
          size.width,
          size.height,
        ),
      )
    }

    function onTouchEnd(event: TouchEvent) {
      if (event.touches.length < 2) {
        pinchRef.current = null
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
      pinchRef.current = null
      if (wheelUndoTimerRef.current) {
        clearTimeout(wheelUndoTimerRef.current)
        wheelUndoTimerRef.current = null
      }
      wheelUndoPendingRef.current = false
    }
  }, [
    isAdjusting,
    notePreviewAdjustUndo,
    previewRef,
    readLivePreview,
    readPreviewSize,
    updatePreview,
  ])

  return {
    isPanDragging,
    onPreviewAdjustPointerDown,
    onPreviewAdjustPointerMove,
    onPreviewAdjustPointerUp: endPreviewAdjustDrag,
    onPreviewAdjustPointerCancel: endPreviewAdjustDrag,
  }
}

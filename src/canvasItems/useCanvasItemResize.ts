import {
  useCallback,
  useEffect,
  useRef,
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
import { playSound } from '../sound/playSound'
import { MIN_ITEM_HEIGHT, MIN_ITEM_WIDTH } from './grabZone'
import { canvasEditingAllowed } from '../canvasEdit/layer'
import { primaryPointerReleased } from './canvasPointerSession'
import { useCanvasItemsStore } from './canvasItemsStore'
import {
  setActiveResizeItem,
  triggerResizeSnapBack,
  useCanvasItemResizeStore,
} from './canvasItemResizeStore'

const RESIZE_THRESHOLD_PX = 8
const RUBBER_BAND = 0.22
const ASPECT_SNAP_HOLD_MS = 600

type ResizePhase = 'idle' | 'pending' | 'active'

type ResizeLimits = {
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
}

export type ResizeOptions = ResizeLimits & {
  /** Keep aspect ratio and grow/shrink from the item centre (study hubs). */
  mode?: 'corner' | 'center-uniform'
  /** Width / height — required when mode is `center-uniform`. */
  aspectRatio?: number
  /** Original import dimensions — enables aspect-ratio proximity snap on hold. */
  importWidth?: number
  importHeight?: number
}

type ResizeSession = {
  itemId: string
  pointerId: number
  phase: ResizePhase
  startClientX: number
  startClientY: number
  startX: number
  startY: number
  startWidth: number
  startHeight: number
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  options?: ResizeOptions
  resizeActivated: boolean
  lastClientX: number
  lastClientY: number
  beyondBounds: boolean
  hasMoved: boolean
  onReleaseWithoutResize?: () => void
  holdStillTimerId: number | null
  threshold: number
}

let resizeSession: ResizeSession | null = null
let detachResizeListeners: (() => void) | null = null
let resizeRafId: number | null = null

function clearHoldStillTimer() {
  if (resizeSession?.holdStillTimerId != null) {
    clearTimeout(resizeSession.holdStillTimerId)
    resizeSession.holdStillTimerId = null
  }
}

function checkAspectRatioSnap(session: ResizeSession) {
  const { importWidth, importHeight } = session.options ?? {}
  if (!importWidth || !importHeight) return

  // Clean up resize and animate snap to original aspect ratio
  const itemId = session.itemId
  cancelResizeRaf()
  removeResizeListeners()
  stopItemResizeSound()
  resizeSession = null
  setActiveResizeItem(null)

  playSound('aspectSnap')
  useCanvasItemsStore.getState().snapToOriginalAspectRatio(itemId)
}

function screenDist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1)
}

function rubberBand(value: number, min: number, max: number): number {
  if (value < min) return min + (value - min) * RUBBER_BAND
  if (value > max) return max + (value - max) * RUBBER_BAND
  return value
}

function removeResizeListeners() {
  detachResizeListeners?.()
  detachResizeListeners = null
}

function cancelResizeRaf() {
  if (resizeRafId != null) {
    cancelAnimationFrame(resizeRafId)
    resizeRafId = null
  }
}

function finishResizeSession() {
  clearHoldStillTimer()

  if (resizeSession && resizeRafId != null) {
    cancelResizeRaf()
    applyResizeMove(resizeSession.lastClientX, resizeSession.lastClientY)
  }

  const ended = resizeSession
  cancelResizeRaf()
  removeResizeListeners()
  resizeSession = null

  if (!ended) {
    setActiveResizeItem(null)
    return
  }

  if (!ended.hasMoved) {
    ended.onReleaseWithoutResize?.()
  }

  if (ended.resizeActivated) {
    stopItemResizeSound()

    if (ended.options?.mode === 'center-uniform') {
      const clamped = computeCenterUniformRect(
        ended.lastClientX,
        ended.lastClientY,
        ended,
        ended.options,
        false,
      )
      if (clamped) {
        const item = useCanvasItemsStore.getState().items.find((i) => i.id === ended.itemId)
        const needsSnap =
          ended.beyondBounds ||
          (item != null &&
            (Math.abs(clamped.width - item.width) > 0.5 ||
              Math.abs(clamped.height - item.height) > 0.5))
        if (needsSnap) triggerResizeSnapBack(ended.itemId)
        useCanvasItemsStore.getState().updateItemRect(
          ended.itemId,
          clamped.x,
          clamped.y,
          clamped.width,
          clamped.height,
          { persist: true, clampStudyHub: true },
        )
      }
    } else {
      const item = useCanvasItemsStore.getState().items.find((i) => i.id === ended.itemId)
      if (item) {
        useCanvasItemsStore.getState().updateItemSize(
          ended.itemId,
          item.width,
          item.height,
          { persist: true },
        )
      }
    }
  }

  setActiveResizeItem(null)
}

export function cancelCanvasItemResize() {
  finishResizeSession()
}

function commitResizeStart() {
  if (!resizeSession || resizeSession.phase !== 'pending') return

  resizeSession.phase = 'active'
  resizeSession.resizeActivated = true
  useCanvasItemsStore.getState().beginItemResize(resizeSession.itemId)
  setActiveResizeItem(resizeSession.itemId)
  startItemResizeSound(resizeSession.startClientX, resizeSession.startClientY)
}

function computeCenterUniformRect(
  clientX: number,
  clientY: number,
  session: ResizeSession,
  options: ResizeOptions,
  elastic: boolean,
): { x: number; y: number; width: number; height: number; beyondBounds: boolean } | null {
  const ref = session.transformRef.current
  if (!ref) return null
  const scale = ref.state.scale

  const dx = (clientX - session.startClientX) / scale
  const dy = (clientY - session.startClientY) / scale

  const minWidth = options.minWidth ?? MIN_ITEM_WIDTH
  const minHeight = options.minHeight ?? MIN_ITEM_HEIGHT
  const maxWidth = options.maxWidth ?? Number.POSITIVE_INFINITY
  const maxHeight = options.maxHeight ?? Number.POSITIVE_INFINITY
  const aspectRatio = options.aspectRatio ?? session.startWidth / session.startHeight

  const scaleX = (session.startWidth + 2 * dx) / session.startWidth
  const scaleY = (session.startHeight + 2 * dy) / session.startHeight
  const rawScale =
    scaleX >= 1 || scaleY >= 1 ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY)

  const minScale = Math.max(minWidth / session.startWidth, minHeight / session.startHeight)
  const maxScale = Math.min(
    maxWidth / session.startWidth,
    maxHeight / session.startHeight,
  )
  const clampedScale = Math.min(maxScale, Math.max(minScale, rawScale))
  const beyondBounds = rawScale < minScale || rawScale > maxScale

  const appliedScale = elastic ? rawScale : clampedScale
  let nextWidth = session.startWidth * appliedScale
  let nextHeight = nextWidth / aspectRatio

  if (elastic) {
    nextWidth = rubberBand(nextWidth, minWidth, maxWidth)
    nextHeight = nextWidth / aspectRatio
    if (nextHeight < minHeight) {
      nextHeight = rubberBand(nextHeight, minHeight, maxHeight)
      nextWidth = nextHeight * aspectRatio
    } else if (nextHeight > maxHeight) {
      nextHeight = rubberBand(nextHeight, minHeight, maxHeight)
      nextWidth = nextHeight * aspectRatio
    }
  } else {
    nextWidth = Math.min(maxWidth, Math.max(minWidth, nextWidth))
    nextHeight = nextWidth / aspectRatio
    if (nextHeight > maxHeight) {
      nextHeight = maxHeight
      nextWidth = nextHeight * aspectRatio
    } else if (nextHeight < minHeight) {
      nextHeight = minHeight
      nextWidth = nextHeight * aspectRatio
    }
  }

  const nextX = session.startX + (session.startWidth - nextWidth) / 2
  const nextY = session.startY + (session.startHeight - nextHeight) / 2

  return { x: nextX, y: nextY, width: nextWidth, height: nextHeight, beyondBounds }
}

function applyResizeMove(clientX: number, clientY: number) {
  if (!resizeSession || resizeSession.phase !== 'active') return

  resizeSession.lastClientX = clientX
  resizeSession.lastClientY = clientY
  updateItemResizeSound(clientX, clientY)

  const options = resizeSession.options
  const elastic = options?.mode === 'center-uniform'

  if (options?.mode === 'center-uniform') {
    const rect = computeCenterUniformRect(
      clientX,
      clientY,
      resizeSession,
      options,
      elastic,
    )
    if (!rect) return
    resizeSession.beyondBounds = rect.beyondBounds
    useCanvasItemsStore.getState().updateItemRect(
      resizeSession.itemId,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      { persist: false, clampStudyHub: !elastic },
    )
    return
  }

  const ref = resizeSession.transformRef.current
  if (!ref) return
  const scale = ref.state.scale
  const dx = (clientX - resizeSession.startClientX) / scale
  const dy = (clientY - resizeSession.startClientY) / scale
  const minWidth = options?.minWidth ?? MIN_ITEM_WIDTH
  const minHeight = options?.minHeight ?? MIN_ITEM_HEIGHT

  useCanvasItemsStore.getState().updateItemSize(
    resizeSession.itemId,
    Math.max(minWidth, resizeSession.startWidth + dx),
    Math.max(minHeight, resizeSession.startHeight + dy),
    { persist: false },
  )
}

function scheduleResizeMove(clientX: number, clientY: number) {
  if (!resizeSession) return
  resizeSession.hasMoved = true
  resizeSession.lastClientX = clientX
  resizeSession.lastClientY = clientY

  // Reset hold-still timer for aspect-ratio snap
  clearHoldStillTimer()
  const session = resizeSession
  resizeSession.holdStillTimerId = window.setTimeout(() => {
    if (resizeSession === session) checkAspectRatioSnap(session)
  }, ASPECT_SNAP_HOLD_MS)

  if (resizeRafId != null) return
  resizeRafId = requestAnimationFrame(() => {
    resizeRafId = null
    if (!resizeSession) return
    applyResizeMove(resizeSession.lastClientX, resizeSession.lastClientY)
  })
}

function attachResizePointerSession(
  itemId: string,
  event: ReactPointerEvent<HTMLButtonElement>,
  width: number,
  height: number,
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  touchDeferred: boolean,
  options?: ResizeOptions,
  onReleaseWithoutResize?: () => void,
) {
  if (!canvasEditingAllowed()) return

  finishResizeSession()

  event.preventDefault()
  event.stopPropagation()

  const pointerId = event.pointerId
  const item = useCanvasItemsStore.getState().items.find((entry) => entry.id === itemId)
  const touchDeferredActive = touchDeferred

  // For text items, measure the editor's natural content size and use it as
  // the resize minimum so the box can never be dragged narrower than text+padding.
  let resolvedOptions = options
  if (item?.type === 'text') {
    const editorEl = document.querySelector<HTMLElement>(
      `[data-item-id="${itemId}"] .canvas-text-editor`,
    )
    if (editorEl) {
      const s = editorEl.style
      const [prevWS, prevW, prevMW, prevH] = [s.whiteSpace, s.width, s.maxWidth, s.height]
      s.whiteSpace = 'nowrap'; s.width = 'max-content'; s.maxWidth = 'none'
      const minW = Math.ceil(editorEl.offsetWidth)
      s.width = `${minW}px`; s.height = 'auto'
      const minH = Math.ceil(editorEl.offsetHeight)
      s.whiteSpace = prevWS; s.width = prevW; s.maxWidth = prevMW; s.height = prevH
      resolvedOptions = {
        ...options,
        minWidth: Math.max(options?.minWidth ?? 0, minW),
        minHeight: Math.max(options?.minHeight ?? 0, minH),
      }
    }
  }

  resizeSession = {
    itemId,
    pointerId,
    phase: touchDeferredActive ? 'pending' : 'active',
    startClientX: event.clientX,
    startClientY: event.clientY,
    lastClientX: event.clientX,
    lastClientY: event.clientY,
    startX: item?.x ?? 0,
    startY: item?.y ?? 0,
    startWidth: width,
    startHeight: height,
    transformRef,
    options: resolvedOptions,
    resizeActivated: !touchDeferredActive,
    beyondBounds: false,
    hasMoved: false,
    onReleaseWithoutResize,
    holdStillTimerId: null,
    threshold: RESIZE_THRESHOLD_PX,
  }

  if (!touchDeferredActive) {
    useCanvasItemsStore.getState().beginItemResize(itemId)
    setActiveResizeItem(itemId)
    startItemResizeSound(event.clientX, event.clientY)
  }

  const endSession = (e: PointerEvent) => {
    if (!resizeSession || e.pointerId !== pointerId) return
    resizeSession.lastClientX = e.clientX
    resizeSession.lastClientY = e.clientY
    finishResizeSession()
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!resizeSession || e.pointerId !== pointerId) return

    if (primaryPointerReleased(e)) {
      resizeSession.lastClientX = e.clientX
      resizeSession.lastClientY = e.clientY
      finishResizeSession()
      return
    }

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
        ) < resizeSession.threshold
      ) {
        return
      }
      commitResizeStart()
    }

    if (e.cancelable) e.preventDefault()
    scheduleResizeMove(e.clientX, e.clientY)
  }

  document.addEventListener('pointermove', onPointerMove, { capture: true })
  document.addEventListener('pointerup', endSession, { capture: true })
  document.addEventListener('pointercancel', endSession, { capture: true })
  window.addEventListener('pointerup', endSession, { capture: true })
  window.addEventListener('pointercancel', endSession, { capture: true })
  window.addEventListener('blur', finishResizeSession)

  const onWindowMouseMove = (e: MouseEvent) => {
    if (!resizeSession || resizeSession.pointerId !== pointerId) return
    if (primaryPointerReleased(e)) {
      resizeSession.lastClientX = e.clientX
      resizeSession.lastClientY = e.clientY
      finishResizeSession()
    }
  }
  window.addEventListener('mousemove', onWindowMouseMove, { capture: true })

  detachResizeListeners = () => {
    document.removeEventListener('pointermove', onPointerMove, true)
    document.removeEventListener('pointerup', endSession, true)
    document.removeEventListener('pointercancel', endSession, true)
    window.removeEventListener('pointerup', endSession, true)
    window.removeEventListener('pointercancel', endSession, true)
    window.removeEventListener('blur', finishResizeSession)
    window.removeEventListener('mousemove', onWindowMouseMove, true)
  }
}

export function useCanvasItemResize(
  itemId: string,
  width: number,
  height: number,
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  _onResizeStateChange?: (resizing: boolean) => void,
  options?: ResizeOptions,
  onReleaseWithoutResize?: () => void,
) {
  const isResizing = useCanvasItemResizeStore((s) => s.activeItemId === itemId)
  const snapBack = useCanvasItemResizeStore((s) => s.snapBackItemId === itemId)
  const optionsRef = useRef(options)
  optionsRef.current = options
  const onReleaseWithoutResizeRef = useRef(onReleaseWithoutResize)
  onReleaseWithoutResizeRef.current = onReleaseWithoutResize

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
        event.pointerType === 'touch',
        optionsRef.current,
        onReleaseWithoutResizeRef.current,
      )
    },
    [height, itemId, transformRef, width],
  )

  return {
    isResizing,
    snapBack,
    handlePointerDown,
  }
}

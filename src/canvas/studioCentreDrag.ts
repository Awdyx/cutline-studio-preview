import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { clientToFullCanvas } from '../drawing/canvasCoords'
import { playSound } from '../sound/playSound'
import {
  startStudioCentreDragSound,
  stopStudioCentreDragSound,
  updateStudioCentreDragSound,
} from '../sound/studioCentreDragSound'
import {
  clampStudioCentrePosition,
  syncStudioCentreCssVars,
} from './studioCentrePosition'
import { useStudioCentrePositionStore } from './studioCentrePositionStore'
import type { CanvasMinimapRect } from './canvasMinimapGeometry'
import {
  applyMinimapPlateDragTransform,
  applyStudioCentreDragTransform,
  cancelStudioCentreDragEdgeSpringBack,
  clearMinimapPlateDragTransform,
  clearStudioCentreDragTransform,
  commitMinimapPlateDragRelease,
  commitStudioCentreDragPosition,
  springBackStudioCentreDragEdge,
} from './studioCentreVisualDrag'
import {
  armStudioCentreDragParallax,
  clearStudioCentreDragParallax,
  settleStudioCentreDragParallax,
} from './studioCentreDragParallax'
import { useStudioCentreDragStore } from './studioCentreDragStore'

const DRAG_THRESHOLD_PX = 8
const DRAG_ACTIVE_CLASS = 'studio-centre-drag-active'
export const STUDIO_CENTRE_HOLD_DRAG_PAN_EXCLUDE_CLASS = 'studio-centre-hold-drag-pending'

type DragPhase = 'pending' | 'dragging'

type DragSession = {
  pointerId: number
  phase: DragPhase
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  grabOffsetX: number
  grabOffsetY: number
  startClientX: number
  startClientY: number
  lastClientX: number
  lastClientY: number
  dragThresholdPx: number
  moved: boolean
  dragStartX: number
  dragStartY: number
  dragAnchorClientX: number
  dragAnchorClientY: number
  lastX: number
  lastY: number
}

let session: DragSession | null = null
let detachListeners: (() => void) | null = null
let dragRafId: number | null = null

type MinimapDragContext = {
  frameEl: HTMLElement
  region: CanvasMinimapRect
  onTap?: () => void
}

let minimapDragCtx: MinimapDragContext | null = null

export function clearStudioCentreHoldDragPanExclude(root: ParentNode = document) {
  root.querySelectorAll(`.${STUDIO_CENTRE_HOLD_DRAG_PAN_EXCLUDE_CLASS}`).forEach((el) => {
    el.classList.remove(STUDIO_CENTRE_HOLD_DRAG_PAN_EXCLUDE_CLASS)
  })
}

function cancelDragRaf() {
  if (dragRafId != null) {
    cancelAnimationFrame(dragRafId)
    dragRafId = null
  }
}

function screenDist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1)
}

function setDragActiveClass(active: boolean) {
  document.documentElement.classList.toggle(DRAG_ACTIVE_CLASS, active)
  if (active) {
    document.documentElement.setAttribute('data-studio-centre-dragging', '')
  } else {
    document.documentElement.removeAttribute('data-studio-centre-dragging')
  }
}

function finishStudioCentreDragDim(): void {
  const root = document.documentElement
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.removeAttribute('data-studio-centre-dragging')
    return
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.removeAttribute('data-studio-centre-dragging')
    })
  })
}

function removeDocumentListeners() {
  detachListeners?.()
  detachListeners = null
}

function releaseBodyPointerCapture(pointerId: number) {
  try {
    if (document.body.hasPointerCapture(pointerId)) {
      document.body.releasePointerCapture(pointerId)
    }
  } catch {
    // ignore
  }
}

function commitDragStart() {
  if (!session || session.phase === 'dragging') return

  const { x, y } = useStudioCentrePositionStore.getState()
  session.dragStartX = x
  session.dragStartY = y
  session.lastX = x
  session.lastY = y
  session.dragAnchorClientX = session.lastClientX
  session.dragAnchorClientY = session.lastClientY
  syncStudioCentreCssVars(x, y)
  clearStudioCentreDragTransform()
  session.phase = 'dragging'
  playSound('studioCentreGrab')
  startStudioCentreDragSound()
  armStudioCentreDragParallax()
  setDragActiveClass(true)
  useStudioCentreDragStore.getState().setStudioCentreDragging(true)
}

function finishSession() {
  cancelStudioCentreDragEdgeSpringBack()
  if (session && dragRafId != null) {
    cancelDragRaf()
    applyDragPosition(session.lastClientX, session.lastClientY)
  }

  const ended = session
  const minimapCtx = minimapDragCtx
  cancelDragRaf()
  removeDocumentListeners()
  session = null
  minimapDragCtx = null
  const hadMove = ended?.moved === true
  clearStudioCentreHoldDragPanExclude()
  useStudioCentreDragStore.getState().setPanSuppressed(false)
  useStudioCentreDragStore.getState().setMinimapDragging(false)
  useStudioCentreDragStore.getState().setStudioCentreDragging(false)
  if (ended) releaseBodyPointerCapture(ended.pointerId)

  if (!ended || ended.phase !== 'dragging') {
    clearStudioCentreDragParallax()
    setDragActiveClass(false)
    if (!hadMove) clearStudioCentreDragTransform()
    clearMinimapPlateDragTransform()
    if (minimapCtx && !hadMove && ended?.phase === 'pending') {
      minimapCtx.onTap?.()
    }
    return
  }

  stopStudioCentreDragSound()
  settleStudioCentreDragParallax()
  if (hadMove) {
    playSound('studioCentreDrop')

    if (minimapCtx) {
      useStudioCentrePositionStore
        .getState()
        .setPosition(ended.lastX, ended.lastY, { persist: true })
      commitMinimapPlateDragRelease(minimapCtx.region, ended.lastX, ended.lastY)
      finishStudioCentreDragDim()
      springBackStudioCentreDragEdge()
      return
    }

    commitStudioCentreDragPosition()
    useStudioCentrePositionStore
      .getState()
      .setPosition(ended.lastX, ended.lastY, { persist: true })
    finishStudioCentreDragDim()
    springBackStudioCentreDragEdge()
    return
  }

  clearStudioCentreDragTransform()
  clearMinimapPlateDragTransform()
  setDragActiveClass(false)
}

function applyDragPosition(clientX: number, clientY: number) {
  if (!session || session.phase !== 'dragging') return

  updateStudioCentreDragSound(clientX, clientY)

  const ref = session.transformRef.current
  if (!ref) return
  const scale = ref.state.scale
  if (!Number.isFinite(scale) || scale <= 0) return

  const dx = (clientX - session.dragAnchorClientX) / scale
  const dy = (clientY - session.dragAnchorClientY) / scale
  const rawX = session.dragStartX + dx
  const rawY = session.dragStartY + dy
  const clamped = clampStudioCentrePosition(rawX, rawY)
  applyStudioCentreDragTransform(
    clamped.x - session.dragStartX,
    clamped.y - session.dragStartY,
    rawX,
    rawY,
  )
  session.lastX = clamped.x
  session.lastY = clamped.y
  session.moved = true
}

function scheduleDragMove(clientX: number, clientY: number) {
  if (!session) return
  session.lastClientX = clientX
  session.lastClientY = clientY

  if (dragRafId != null) return
  dragRafId = requestAnimationFrame(() => {
    dragRafId = null
    if (!session) return
    applyDragPosition(session.lastClientX, session.lastClientY)
  })
}

function attachDocumentListeners() {
  removeDocumentListeners()

  const onMove = (event: PointerEvent) => {
    if (!session || event.pointerId !== session.pointerId) return

    if (session.phase === 'pending') {
      const dist = screenDist(
        session.startClientX,
        session.startClientY,
        event.clientX,
        event.clientY,
      )
      if (dist >= session.dragThresholdPx) {
        commitDragStart()
      }
    }

    if (session.phase === 'dragging') {
      event.preventDefault()
      scheduleDragMove(event.clientX, event.clientY)
    }
  }

  const onEnd = (event: PointerEvent) => {
    if (!session || event.pointerId !== session.pointerId) return
    finishSession()
  }

  document.addEventListener('pointermove', onMove, { passive: false })
  document.addEventListener('pointerup', onEnd)
  document.addEventListener('pointercancel', onEnd)

  detachListeners = () => {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onEnd)
    document.removeEventListener('pointercancel', onEnd)
  }
}

function startDragSession(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  pointerId: number,
  clientX: number,
  clientY: number,
  opts?: { dragThresholdPx?: number; commitImmediately?: boolean },
) {
  const { x, y } = useStudioCentrePositionStore.getState()
  const pointerCanvas = clientToFullCanvas(clientX, clientY, transformRef)
  if (!pointerCanvas) return

  finishSession()

  session = {
    pointerId,
    phase: 'pending',
    transformRef,
    grabOffsetX: pointerCanvas.x - x,
    grabOffsetY: pointerCanvas.y - y,
    startClientX: clientX,
    startClientY: clientY,
    lastClientX: clientX,
    lastClientY: clientY,
    dragThresholdPx: opts?.dragThresholdPx ?? DRAG_THRESHOLD_PX,
    moved: false,
    dragStartX: x,
    dragStartY: y,
    lastX: x,
    lastY: y,
    dragAnchorClientX: clientX,
    dragAnchorClientY: clientY,
  }

  try {
    document.body.setPointerCapture(pointerId)
  } catch {
    // ignore
  }

  useStudioCentreDragStore.getState().setPanSuppressed(true)
  attachDocumentListeners()

  if (opts?.commitImmediately) {
    commitDragStart()
    applyDragPosition(clientX, clientY)
  }
}

export function startStudioCentreDragAtScreen(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  pointerId: number,
  clientX: number,
  clientY: number,
  opts?: { dragThresholdPx?: number; commitImmediately?: boolean },
) {
  startDragSession(transformRef, pointerId, clientX, clientY, opts)
}

export function onStudioCentreDragPointerDown(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  event: ReactPointerEvent<HTMLElement>,
  opts?: { dragThresholdPx?: number; commitImmediately?: boolean },
) {
  if (event.pointerType === 'mouse' && event.button !== 0) return

  event.preventDefault()
  event.stopPropagation()

  startDragSession(transformRef, event.pointerId, event.clientX, event.clientY, opts)
}

export function isStudioCentreDragActive(): boolean {
  return session != null
}

export function cancelStudioCentreDrag() {
  finishSession()
}

/** Drag from expanded minimap — maps pointer within frame to full canvas coords. */
export function onStudioCentreMinimapDragPointerDown(
  event: React.PointerEvent<HTMLElement>,
  frameEl: HTMLElement,
  grabOffsetX: number,
  grabOffsetY: number,
  region: CanvasMinimapRect,
  onTap?: () => void,
) {
  if (event.pointerType === 'mouse' && event.button !== 0) return

  event.preventDefault()
  event.stopPropagation()

  finishSession()

  const frameRect = frameEl.getBoundingClientRect()
  if (frameRect.width <= 0 || frameRect.height <= 0) return

  const { x, y } = useStudioCentrePositionStore.getState()

  session = {
    pointerId: event.pointerId,
    phase: 'pending',
    transformRef: { current: null },
    grabOffsetX,
    grabOffsetY,
    startClientX: event.clientX,
    startClientY: event.clientY,
    lastClientX: event.clientX,
    lastClientY: event.clientY,
    dragThresholdPx: DRAG_THRESHOLD_PX,
    moved: false,
    dragStartX: x,
    dragStartY: y,
    dragAnchorClientX: event.clientX,
    dragAnchorClientY: event.clientY,
    lastX: x,
    lastY: y,
  }

  minimapDragCtx = { frameEl, region, onTap }
  useStudioCentreDragStore.getState().setPanSuppressed(true)

  try {
    document.body.setPointerCapture(event.pointerId)
  } catch {
    // ignore
  }

  const pointerToCanvas = (clientX: number, clientY: number) => {
    const rect = frameEl.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    const pctX = (clientX - rect.left) / rect.width
    const pctY = (clientY - rect.top) / rect.height
    return {
      x: region.x + pctX * region.width,
      y: region.y + pctY * region.height,
    }
  }

  let minimapRafId: number | null = null
  let minimapLastX = event.clientX
  let minimapLastY = event.clientY

  const commitMinimapDrag = () => {
    if (!session || session.phase !== 'pending') return
    session.phase = 'dragging'
    syncStudioCentreCssVars(session.dragStartX, session.dragStartY)
    clearStudioCentreDragTransform()
    clearMinimapPlateDragTransform()
    playSound('studioCentreGrab')
    startStudioCentreDragSound()
    armStudioCentreDragParallax()
    setDragActiveClass(true)
    useStudioCentreDragStore.getState().setMinimapDragging(true)
  }

  const applyMinimapDrag = () => {
    minimapRafId = null
    if (!session || session.phase !== 'dragging') return
    const pos = pointerToCanvas(minimapLastX, minimapLastY)
    if (!pos) return
    const rawX = pos.x - grabOffsetX
    const rawY = pos.y - grabOffsetY
    const clamped = clampStudioCentrePosition(rawX, rawY)
    const dx = clamped.x - session.dragStartX
    const dy = clamped.y - session.dragStartY
    applyMinimapPlateDragTransform(dx, dy, region, rawX, rawY)
    session.lastX = clamped.x
    session.lastY = clamped.y
    session.moved = true
    updateStudioCentreDragSound(minimapLastX, minimapLastY)
  }

  const onMove = (moveEvent: PointerEvent) => {
    if (!session || moveEvent.pointerId !== session.pointerId) return

    if (session.phase === 'pending') {
      const dist = screenDist(
        session.startClientX,
        session.startClientY,
        moveEvent.clientX,
        moveEvent.clientY,
      )
      if (dist < session.dragThresholdPx) return
      commitMinimapDrag()
    }

    if (session.phase !== 'dragging') return

    moveEvent.preventDefault()
    minimapLastX = moveEvent.clientX
    minimapLastY = moveEvent.clientY
    if (minimapRafId != null) return
    minimapRafId = requestAnimationFrame(applyMinimapDrag)
  }

  const onEnd = (endEvent: PointerEvent) => {
    if (!session || endEvent.pointerId !== session.pointerId) return
    if (minimapRafId != null) {
      cancelAnimationFrame(minimapRafId)
      applyMinimapDrag()
    }
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onEnd)
    document.removeEventListener('pointercancel', onEnd)
    finishSession()
  }

  document.addEventListener('pointermove', onMove, { passive: false })
  document.addEventListener('pointerup', onEnd)
  document.addEventListener('pointercancel', onEnd)

  detachListeners = () => {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onEnd)
    document.removeEventListener('pointercancel', onEnd)
  }
}

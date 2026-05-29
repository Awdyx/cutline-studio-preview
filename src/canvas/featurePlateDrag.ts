import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { clientToFullCanvas } from '../drawing/canvasCoords'
import { playSound } from '../sound/playSound'
import {
  startStudioCentreDragSound,
  stopStudioCentreDragSound,
  updateStudioCentreDragSound,
} from '../sound/studioCentreDragSound'
import { clampFeaturePlatePosition } from './studioCentrePosition'
import type { FeaturePlateDestination } from './canvasPlate'
import { syncFeaturePlateLayoutVars } from './canvasPlate'
import { useFeaturePlatePositionStore } from './featurePlatePositionStore'
import type { CanvasMinimapRect } from './canvasMinimapGeometry'
import {
  applyFeaturePlateDragTransform,
  applyFeaturePlateMinimapDragTransform,
  clearFeaturePlateDragTransform,
  clearFeaturePlateMinimapDragTransform,
  commitFeaturePlateDragPosition,
  commitFeaturePlateMinimapDragRelease,
  springBackFeaturePlateDragEdge,
} from './featurePlateVisualDrag'
import { resetStudioCentreDragEdgeSquish } from './studioCentreDragEdgeBump'
import { cancelStudioCentreDragEdgeSpringBack } from './studioCentreVisualDrag'
import { addFeaturePlateDragImpulse } from './featurePlateDragImpulse'
import { useStudioCentreDragStore } from './studioCentreDragStore'

const DRAG_THRESHOLD_PX = 8
const DRAG_ACTIVE_CLASS = 'feature-plate-drag-active'

type DragPhase = 'pending' | 'dragging'

type DragSession = {
  dest: FeaturePlateDestination
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
  dest: FeaturePlateDestination
  frameEl: HTMLElement
  region: CanvasMinimapRect
  onTap?: () => void
}

let minimapDragCtx: MinimapDragContext | null = null

function screenDist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1)
}

function setDragActiveClass(active: boolean, dest: FeaturePlateDestination | null) {
  document.documentElement.classList.toggle(DRAG_ACTIVE_CLASS, active)
  if (active && dest) {
    document.documentElement.setAttribute('data-feature-plate-dragging', dest)
  } else {
    document.documentElement.removeAttribute('data-feature-plate-dragging')
  }
  useStudioCentreDragStore.getState().setFeaturePlateDragging(active && dest ? dest : null)
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

  const { dest } = session
  const { x, y } = useFeaturePlatePositionStore.getState().positions[dest]
  session.dragStartX = x
  session.dragStartY = y
  session.lastX = x
  session.lastY = y
  session.dragAnchorClientX = session.lastClientX
  session.dragAnchorClientY = session.lastClientY
  syncFeaturePlateLayoutVars(dest, x, y)
  clearFeaturePlateDragTransform(dest)
  session.phase = 'dragging'
  playSound('studioCentreGrab')
  startStudioCentreDragSound()
  setDragActiveClass(true, dest)
}

function finishSession() {
  cancelStudioCentreDragEdgeSpringBack()
  if (session && dragRafId != null) {
    cancelAnimationFrame(dragRafId)
    dragRafId = null
    applyDragPosition(session.lastClientX, session.lastClientY)
  }

  const ended = session
  const minimapCtx = minimapDragCtx
  if (dragRafId != null) {
    cancelAnimationFrame(dragRafId)
    dragRafId = null
  }
  removeDocumentListeners()
  session = null
  minimapDragCtx = null
  const hadMove = ended?.moved === true
  const dest = ended?.dest
  useStudioCentreDragStore.getState().setPanSuppressed(false)
  useStudioCentreDragStore.getState().setMinimapDragging(false)
  if (ended) releaseBodyPointerCapture(ended.pointerId)

  if (!ended || ended.phase !== 'dragging' || !dest) {
    setDragActiveClass(false, null)
    if (dest) clearFeaturePlateDragTransform(dest)
    if (dest) clearFeaturePlateMinimapDragTransform(dest)
    if (minimapCtx && !hadMove && ended?.phase === 'pending') {
      minimapCtx.onTap?.()
    }
    return
  }

  stopStudioCentreDragSound()
  if (hadMove) {
    playSound('studioCentreDrop')

    if (minimapCtx) {
      useFeaturePlatePositionStore
        .getState()
        .setPosition(dest, ended.lastX, ended.lastY, { persist: true })
      commitFeaturePlateMinimapDragRelease(
        dest,
        minimapCtx.region,
        ended.lastX,
        ended.lastY,
      )
      springBackFeaturePlateDragEdge(dest)
      return
    }

    commitFeaturePlateDragPosition(dest)
    useFeaturePlatePositionStore
      .getState()
      .setPosition(dest, ended.lastX, ended.lastY, { persist: true })
    springBackFeaturePlateDragEdge(dest)
    return
  }

  clearFeaturePlateDragTransform(dest)
  clearFeaturePlateMinimapDragTransform(dest)
  setDragActiveClass(false, null)
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
  const clamped = clampFeaturePlatePosition(rawX, rawY)
  const impulseDx = clamped.x - session.lastX
  const impulseDy = clamped.y - session.lastY
  addFeaturePlateDragImpulse(session.dest, impulseDx, impulseDy)
  applyFeaturePlateDragTransform(
    session.dest,
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
  dest: FeaturePlateDestination,
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  pointerId: number,
  clientX: number,
  clientY: number,
  opts?: { dragThresholdPx?: number; commitImmediately?: boolean },
) {
  const { x, y } = useFeaturePlatePositionStore.getState().positions[dest]
  const pointerCanvas = clientToFullCanvas(clientX, clientY, transformRef)
  if (!pointerCanvas) return

  finishSession()
  resetStudioCentreDragEdgeSquish()

  session = {
    dest,
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

export function onFeaturePlateDragPointerDown(
  dest: FeaturePlateDestination,
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  event: ReactPointerEvent<HTMLElement>,
  opts?: { dragThresholdPx?: number; commitImmediately?: boolean },
) {
  if (event.pointerType === 'mouse' && event.button !== 0) return

  event.preventDefault()
  event.stopPropagation()

  startDragSession(dest, transformRef, event.pointerId, event.clientX, event.clientY, opts)
}

export function onFeaturePlateMinimapDragPointerDown(
  dest: FeaturePlateDestination,
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
  resetStudioCentreDragEdgeSquish()

  const { x, y } = useFeaturePlatePositionStore.getState().positions[dest]

  session = {
    dest,
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

  minimapDragCtx = { dest, frameEl, region, onTap }
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
    syncFeaturePlateLayoutVars(dest, session.dragStartX, session.dragStartY)
    clearFeaturePlateDragTransform(dest)
    clearFeaturePlateMinimapDragTransform(dest)
    playSound('studioCentreGrab')
    startStudioCentreDragSound()
    setDragActiveClass(true, dest)
    useStudioCentreDragStore.getState().setMinimapDragging(true)
  }

  const applyMinimapDrag = () => {
    minimapRafId = null
    if (!session || session.phase !== 'dragging') return
    const pos = pointerToCanvas(minimapLastX, minimapLastY)
    if (!pos) return
    const rawX = pos.x - grabOffsetX
    const rawY = pos.y - grabOffsetY
    const clamped = clampFeaturePlatePosition(rawX, rawY)
    const dx = clamped.x - session.dragStartX
    const dy = clamped.y - session.dragStartY
    addFeaturePlateDragImpulse(dest, clamped.x - session.lastX, clamped.y - session.lastY)
    applyFeaturePlateMinimapDragTransform(dest, dx, dy, region, rawX, rawY)
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

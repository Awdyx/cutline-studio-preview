import {
  isFreeFormPin,
  readPinDimensions,
  type UiAnchorId,
  type UiPin,
} from './types'
import { useUiCustomizationStore } from './uiCustomizationStore'
import {
  readUiAnchorVisualScale,
  uiAnchorElement,
  uiAnchorFocusScale,
} from './uiAnchorFocusScale'

/** Screen pixels a pin must sit beyond the anchor edge before throw-to-dismiss. */
export const UI_PIN_DISMISS_MARGIN_PX = 75

const DRAG_THRESHOLD_PX = 3

type DragState = {
  startX: number
  startY: number
  startOffsetX: number
  startOffsetY: number
  moved: boolean
  outOfBoundsDelete: boolean
}

type PinchState = {
  dist: number
  angle: number
  size: number
  width: number
  height: number
  rotation: number
  free: boolean
}

type PinGestureSession = {
  pinId: string
  anchorId: UiAnchorId
  captureEl: HTMLElement
  activePointers: Map<number, { x: number; y: number }>
  drag: DragState | null
  pinch: PinchState | null
}

let session: PinGestureSession | null = null
let listenersAttached = false

export function getPinGestureSession(): PinGestureSession | null {
  return session
}

function pinDistanceBeyondAnchorBounds(
  anchorId: string,
  offsetX: number,
  offsetY: number,
): number | null {
  const el = uiAnchorElement(anchorId)
  if (!el) return null
  const halfW = el.offsetWidth / 2
  const halfH = el.offsetHeight / 2
  const beyondX = Math.max(0, Math.abs(offsetX) - halfW)
  const beyondY = Math.max(0, Math.abs(offsetY) - halfH)
  const logicalBeyond = Math.hypot(beyondX, beyondY)
  const visualScale = readUiAnchorVisualScale(el)
  return logicalBeyond * visualScale
}

function getPinchProps(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return {
    dist: Math.hypot(dx, dy),
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
  }
}

function readPinFromStore(pinId: string): UiPin | null {
  return useUiCustomizationStore.getState().pins.find((p) => p.id === pinId) ?? null
}

function setPinDragging(active: boolean) {
  if (typeof document === 'undefined') return
  if (active) {
    document.documentElement.setAttribute('data-ui-pin-dragging', '1')
  } else {
    document.documentElement.removeAttribute('data-ui-pin-dragging')
  }
}

function syncGestureMode() {
  if (!session) return
  const pin = readPinFromStore(session.pinId)
  if (!pin) return

  const pts = [...session.activePointers.values()]
  if (pts.length >= 2) {
    session.drag = null
    const [a, b] = pts
    const props = getPinchProps(a, b)
    const free = isFreeFormPin(pin)
    const { width: pw, height: ph } = readPinDimensions(pin)
    session.pinch = {
      ...props,
      size: pin.size,
      width: pw,
      height: ph,
      rotation: pin.rotation,
      free,
    }
    return
  }

  session.pinch = null
  if (pts.length === 1 && !session.drag) {
    const pt = pts[0]
    session.drag = {
      startX: pt.x,
      startY: pt.y,
      startOffsetX: pin.offsetX,
      startOffsetY: pin.offsetY,
      moved: false,
      outOfBoundsDelete: false,
    }
  }
}

function handlePointerMove(e: PointerEvent) {
  if (!session?.activePointers.has(e.pointerId)) return
  session.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

  const pin = readPinFromStore(session.pinId)
  if (!pin) return

  const pts = [...session.activePointers.values()]

  if (pts.length >= 2 && session.pinch) {
    const [a, b] = pts
    const props = getPinchProps(a, b)
    const scaleFactor =
      session.pinch.dist > 0 ? props.dist / session.pinch.dist : 1
    const angleDelta = props.angle - session.pinch.angle
    const rawRotation = session.pinch.rotation + angleDelta
    const newRotation = ((rawRotation % 360) + 360) % 360
    const signed = newRotation > 180 ? newRotation - 360 : newRotation

    const { rotatePin, resizePinRect, resizePinUniform } =
      useUiCustomizationStore.getState()
    rotatePin(session.pinId, Math.round(signed))
    if (session.pinch.free) {
      resizePinRect(
        session.pinId,
        session.pinch.width * scaleFactor,
        session.pinch.height * scaleFactor,
      )
    } else {
      resizePinUniform(session.pinId, session.pinch.size * scaleFactor)
    }
    return
  }

  if (!session.drag) return
  const dx = e.clientX - session.drag.startX
  const dy = e.clientY - session.drag.startY
  if (!session.drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return

  session.drag.moved = true
  setPinDragging(true)

  const scale = uiAnchorFocusScale(session.anchorId)
  const newOffsetX = session.drag.startOffsetX + dx / scale
  const newOffsetY = session.drag.startOffsetY + dy / scale
  const beyond = pinDistanceBeyondAnchorBounds(
    session.anchorId,
    newOffsetX,
    newOffsetY,
  )
  if (beyond != null) {
    session.drag.outOfBoundsDelete =
      session.drag.outOfBoundsDelete || beyond > UI_PIN_DISMISS_MARGIN_PX
  }

  useUiCustomizationStore
    .getState()
    .movePin(session.pinId, session.anchorId, newOffsetX, newOffsetY)
}

function releasePointer(e: PointerEvent) {
  if (!session) return

  session.activePointers.delete(e.pointerId)
  if (
    session.captureEl.isConnected &&
    session.captureEl.hasPointerCapture(e.pointerId)
  ) {
    session.captureEl.releasePointerCapture(e.pointerId)
  }

  if (session.activePointers.size < 2) {
    session.pinch = null
  }

  if (session.activePointers.size === 0) {
    if (session.drag?.outOfBoundsDelete) {
      useUiCustomizationStore.getState().deletePin(session.pinId)
    }
    endPinGesture()
    return
  }

  syncGestureMode()
}

function onDocumentPointerDown(e: PointerEvent) {
  if (!session || e.button !== 0) return
  if (session.activePointers.has(e.pointerId)) return

  const target = e.target
  if (!(target instanceof Element)) return
  if (!target.closest(`[data-ui-pin='${session.pinId}']`)) return

  e.preventDefault()
  session.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (session.captureEl.isConnected) {
    try {
      session.captureEl.setPointerCapture(e.pointerId)
    } catch {
      // Ignore capture failures on unsupported pointers.
    }
  }
  syncGestureMode()
}

function attachDocumentListeners() {
  if (listenersAttached || typeof document === 'undefined') return
  listenersAttached = true
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  document.addEventListener('pointermove', handlePointerMove, true)
  document.addEventListener('pointerup', releasePointer, true)
  document.addEventListener('pointercancel', releasePointer, true)
}

function detachDocumentListeners() {
  if (!listenersAttached || typeof document === 'undefined') return
  listenersAttached = false
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.removeEventListener('pointermove', handlePointerMove, true)
  document.removeEventListener('pointerup', releasePointer, true)
  document.removeEventListener('pointercancel', releasePointer, true)
}

export function endPinGesture() {
  if (!session) return

  for (const pointerId of session.activePointers.keys()) {
    if (
      session.captureEl.isConnected &&
      session.captureEl.hasPointerCapture(pointerId)
    ) {
      session.captureEl.releasePointerCapture(pointerId)
    }
  }

  session = null
  setPinDragging(false)
  detachDocumentListeners()
}

export function beginPinPointerDown({
  pinId,
  anchorId,
  captureEl,
  pointerId,
  clientX,
  clientY,
}: {
  pinId: string
  anchorId: UiAnchorId
  captureEl: HTMLElement
  pointerId: number
  clientX: number
  clientY: number
}) {
  if (session && session.pinId !== pinId) {
    endPinGesture()
  }

  if (!session) {
    session = {
      pinId,
      anchorId,
      captureEl,
      activePointers: new Map(),
      drag: null,
      pinch: null,
    }
    attachDocumentListeners()
  } else {
    session.captureEl = captureEl
    session.anchorId = anchorId
  }

  try {
    captureEl.setPointerCapture(pointerId)
  } catch {
    // Ignore capture failures on unsupported pointers.
  }

  session.activePointers.set(pointerId, { x: clientX, y: clientY })
  syncGestureMode()
}

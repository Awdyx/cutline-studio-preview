import type { PointerEvent as ReactPointerEvent } from 'react'
import { useCanvasNavigationStore } from '../canvas/canvasNavigationStore'
import { canvasEditingAllowed } from '../canvasEdit/layer'
import { isTouchPointerStillActive } from '../canvas/canvasPointer'
import { primaryPointerReleased } from './canvasPointerSession'
import { clientToCanvasFromElementForItem } from '../drawing/canvasCoords'
import { playSound } from '../sound/playSound'
import {
  startItemDragSound,
  stopItemDragSound,
  updateItemDragSound,
} from '../sound/itemDragSound'
import {
  dropPositionForItem,
  hitTestSpacePreviewAt,
} from '../spaces/spaceDropTarget'
import {
  isItemWithinStudioCentre,
  showStudioCentreBoundsToast,
} from '../canvas/studioCentre'
import { useSpaceDropStore } from '../spaces/spaceDropStore'
import { useStickyDropStore } from './stickyDropStore'
import {
  hitTestStickyForImageDrop,
  imageCanvasPosition,
  imageLocalPositionInSticky,
} from './stickyImagePlacement'
import { useCanvasItemDragStore, triggerBoundsSnapBack } from './canvasItemDragStore'
import { useCanvasItemsStore } from './canvasItemsStore'
import { isImageInSticky, isStickyItem } from './types'

const DRAG_THRESHOLD_PX = 8
const DRAG_ACTIVE_CLASS = 'canvas-item-drag-active'
const HOLD_DRAG_PAN_EXCLUDE_CLASS = 'canvas-item-hold-drag-pending'
const SPACE_DROP_ABSORB_MS = 340
const STICKY_DROP_ABSORB_MS = 340

type DragSessionOptions = {
  onReleaseWithoutDrag?: () => void
  /** Override move threshold before drag commits (0 = first move after hold-select). */
  dragThresholdPx?: number
}

export function clearHoldDragPanExclude(root: ParentNode = document) {
  root.querySelectorAll(`.${HOLD_DRAG_PAN_EXCLUDE_CLASS}`).forEach((el) => {
    el.classList.remove(HOLD_DRAG_PAN_EXCLUDE_CLASS)
  })
}

let spaceDropTimer: ReturnType<typeof setTimeout> | null = null
let stickyDropTimer: ReturnType<typeof setTimeout> | null = null

function clearSpaceDropTimer() {
  if (spaceDropTimer != null) {
    clearTimeout(spaceDropTimer)
    spaceDropTimer = null
  }
}

function clearStickyDropTimer() {
  if (stickyDropTimer != null) {
    clearTimeout(stickyDropTimer)
    stickyDropTimer = null
  }
}

function clearSpaceDropState() {
  clearSpaceDropTimer()
  useSpaceDropStore.getState().clearAll()
}

function clearStickyDropState() {
  clearStickyDropTimer()
  useStickyDropStore.getState().clearAll()
}

function clearAllDropState() {
  clearSpaceDropState()
  clearStickyDropState()
}

function findDraggedItem(itemId: string) {
  return useCanvasItemsStore.getState().items.find((entry) => entry.id === itemId)
}

function findStickyForItem(itemId: string) {
  const item = findDraggedItem(itemId)
  if (!item || item.type !== 'image' || !isImageInSticky(item)) return null
  return (
    useCanvasItemsStore
      .getState()
      .items.find(
        (entry) => entry.id === item.stickyId && isStickyItem(entry),
      ) ?? null
  )
}

function itemCanvasOrigin(item: ReturnType<typeof findDraggedItem>) {
  if (!item) return { x: 0, y: 0 }
  if (item.type === 'image' && isImageInSticky(item)) {
    const sticky = findStickyForItem(item.id)
    if (sticky) return imageCanvasPosition(item, sticky)
  }
  return { x: item.x, y: item.y }
}

function updateStickyDropHover(
  clientX: number,
  clientY: number,
  itemId: string,
  canvasEl: HTMLElement,
) {
  const item = findDraggedItem(itemId)
  if (!item || item.type !== 'image' || isImageInSticky(item)) {
    useStickyDropStore.getState().setHover(null)
    return
  }

  const hit = hitTestStickyForImageDrop(clientX, clientY, itemId, canvasEl)
  if (!hit) {
    useStickyDropStore.getState().setHover(null)
    return
  }

  const sticky = useCanvasItemsStore.getState().getStickyById(hit.stickyId)
  if (!sticky) {
    useStickyDropStore.getState().setHover(null)
    return
  }

  const local = imageLocalPositionInSticky(item, sticky)
  useStickyDropStore.getState().setHover({
    stickyId: hit.stickyId,
    ghostItem: { ...item, x: local.x, y: local.y },
  })
}

function executeStickyDrop(
  itemId: string,
  hit: ReturnType<typeof hitTestStickyForImageDrop> & object,
) {
  const item = findDraggedItem(itemId)
  if (!item || item.type !== 'image') {
    clearStickyDropState()
    return
  }

  const sticky = useCanvasItemsStore.getState().getStickyById(hit.stickyId)
  if (!sticky) {
    clearStickyDropState()
    return
  }

  const local = imageLocalPositionInSticky(item, sticky)
  const dropStore = useStickyDropStore.getState()
  dropStore.pulseConfirm(hit.stickyId)
  dropStore.startAbsorb(itemId, hit.stickyId)
  dropStore.setHover({
    stickyId: hit.stickyId,
    ghostItem: { ...item, x: local.x, y: local.y },
  })

  clearStickyDropTimer()
  stickyDropTimer = setTimeout(() => {
    stickyDropTimer = null
    useCanvasItemsStore.getState().moveImageToSticky(itemId, hit.stickyId)
    useStickyDropStore.getState().clearHover()
    requestAnimationFrame(() => {
      useStickyDropStore.getState().clearAbsorb()
    })
  }, STICKY_DROP_ABSORB_MS)
}

function updateSpaceDropHover(clientX: number, clientY: number, itemId: string) {
  const hit = hitTestSpacePreviewAt(clientX, clientY, itemId)
  const item = useCanvasItemsStore.getState().items.find((entry) => entry.id === itemId)
  if (!hit || !item) {
    useSpaceDropStore.getState().setHover(null)
    return
  }
  const pos = dropPositionForItem(item, hit.canvasX, hit.canvasY)
  useSpaceDropStore.getState().setHover({
    spaceId: hit.spaceId,
    ghostItem: { ...item, x: pos.x, y: pos.y },
  })
}

function executeSpaceDrop(
  itemId: string,
  hit: ReturnType<typeof hitTestSpacePreviewAt> & object,
) {
  const item = useCanvasItemsStore.getState().items.find((entry) => entry.id === itemId)
  if (!item) {
    clearSpaceDropState()
    return
  }

  const pos = dropPositionForItem(item, hit.canvasX, hit.canvasY)
  const dropStore = useSpaceDropStore.getState()
  dropStore.pulseConfirm(hit.spaceId)
  dropStore.startAbsorb(itemId, hit.spaceId)
  dropStore.setHover({
    spaceId: hit.spaceId,
    ghostItem: { ...item, x: pos.x, y: pos.y },
  })

  clearSpaceDropTimer()
  spaceDropTimer = setTimeout(() => {
    spaceDropTimer = null
    const moved = useCanvasItemsStore
      .getState()
      .moveItemToSpace(itemId, hit.spaceId, hit.canvasX, hit.canvasY)
    if (moved) {
      useSpaceDropStore.getState().markEnteringItem(itemId)
      window.setTimeout(() => {
        useSpaceDropStore.getState().clearEnteringItem()
      }, 420)
    }
    useSpaceDropStore.getState().clearHover()
    requestAnimationFrame(() => {
      useSpaceDropStore.getState().clearAbsorb()
    })
  }, SPACE_DROP_ABSORB_MS)
}

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
  lastClientX: number
  lastClientY: number
  dragThresholdPx: number
  moved: boolean
  dragStartX: number
  dragStartY: number
  onReleaseWithoutDrag?: () => void
}

let session: DragSession | null = null
let detachListeners: (() => void) | null = null
let dragRafId: number | null = null

function cancelDragRaf() {
  if (dragRafId != null) {
    cancelAnimationFrame(dragRafId)
    dragRafId = null
  }
}

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
  if (active) {
    document.documentElement.setAttribute('data-canvas-item-dragging', '')
  } else {
    document.documentElement.removeAttribute('data-canvas-item-dragging')
  }
}

function clearActiveItem() {
  useCanvasItemDragStore.setState({ activeItemId: null })
}

function setPointerSessionActive(active: boolean) {
  useCanvasItemDragStore.setState({ pointerSessionActive: active })
}

function removeDocumentListeners() {
  detachListeners?.()
  detachListeners = null
}

function commitDragStart() {
  if (!session || session.phase === 'dragging') return

  const item = findDraggedItem(session.itemId)
  if (item) {
    session.dragStartX = item.x
    session.dragStartY = item.y
  }

  session.phase = 'dragging'
  const store = useCanvasItemsStore.getState()
  store.beginItemDrag(session.itemId)
  playSound('itemGrab')
  startItemDragSound()
  useCanvasItemDragStore.setState({ activeItemId: session.itemId })
  setDragActiveClass(true)
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

function finishSession() {
  if (session && dragRafId != null) {
    cancelDragRaf()
    applyDragPosition(session.lastClientX, session.lastClientY)
  }

  const ended = session
  cancelDragRaf()
  removeDocumentListeners()
  session = null
  setDragActiveClass(false)
  clearActiveItem()
  setPointerSessionActive(false)
  clearHoldDragPanExclude()
  if (ended) releaseBodyPointerCapture(ended.pointerId)

  if (!ended) {
    clearAllDropState()
    return
  }

  if (ended.phase === 'pending') {
    clearAllDropState()
    ended.onReleaseWithoutDrag?.()
    return
  }

  const stickyDropHit = hitTestStickyForImageDrop(
    ended.lastClientX,
    ended.lastClientY,
    ended.itemId,
    ended.canvasEl,
  )
  if (stickyDropHit) {
    stopItemDragSound()
    executeStickyDrop(ended.itemId, stickyDropHit)
    return
  }

  const dropHit = hitTestSpacePreviewAt(
    ended.lastClientX,
    ended.lastClientY,
    ended.itemId,
  )
  if (dropHit) {
    stopItemDragSound()
    executeSpaceDrop(ended.itemId, dropHit)
    return
  }

  clearAllDropState()
  stopItemDragSound()

  const droppedItem = findDraggedItem(ended.itemId)
  if (!droppedItem) return

  if (isImageInSticky(droppedItem)) {
    if (ended.moved) {
      playSound('itemDrop')
      useCanvasItemsStore.getState().updateItemPosition(
        droppedItem.id,
        droppedItem.x,
        droppedItem.y,
        { persist: true },
      )
    }
    return
  }

  const dropCanvasPosition = (drag: DragSession) => {
    const pos = clientToCanvasFromElementForItem(
      drag.lastClientX,
      drag.lastClientY,
      drag.canvasEl,
    )
    if (!pos) return null
    return {
      x: pos.x - drag.grabOffsetX,
      y: pos.y - drag.grabOffsetY,
    }
  }

  const finalPos = dropCanvasPosition(ended)
  const itemAtRelease = finalPos
    ? { ...droppedItem, x: finalPos.x, y: finalPos.y }
    : droppedItem

  const allItems = useCanvasItemsStore.getState().items
  if (!isItemWithinStudioCentre(itemAtRelease, allItems)) {
    useCanvasItemsStore.getState().animateItemRectTo(
      ended.itemId,
      { x: ended.dragStartX, y: ended.dragStartY },
      { persist: true },
    )
    triggerBoundsSnapBack(ended.itemId)
    showStudioCentreBoundsToast()
    return
  }

  if (ended.moved) {
    playSound('itemDrop')

    const item = findDraggedItem(ended.itemId)
    if (item) {
      useCanvasItemsStore.getState().updateItemPosition(item.id, item.x, item.y, {
        persist: true,
      })
    }
  }
}

function applyDragPosition(clientX: number, clientY: number) {
  if (!session || session.phase !== 'dragging') return

  updateItemDragSound(clientX, clientY)

  const pos = clientToCanvasFromElementForItem(clientX, clientY, session.canvasEl)
  if (!pos) return

  const item = findDraggedItem(session.itemId)
  const canvasX = pos.x - session.grabOffsetX
  const canvasY = pos.y - session.grabOffsetY

  if (item?.type === 'image' && isImageInSticky(item)) {
    const sticky = findStickyForItem(item.id)
    if (sticky) {
      useCanvasItemsStore.getState().updateItemPosition(
        session.itemId,
        canvasX - sticky.x,
        canvasY - sticky.y,
        { persist: false },
      )
    }
  } else {
    useCanvasItemsStore.getState().updateItemPosition(
      session.itemId,
      canvasX,
      canvasY,
      { persist: false },
    )
  }

  session.moved = true
  updateSpaceDropHover(clientX, clientY, session.itemId)
  updateStickyDropHover(clientX, clientY, session.itemId, session.canvasEl)
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

function startDragSession(
  itemId: string,
  pointerId: number,
  canvasEl: HTMLElement,
  clientX: number,
  clientY: number,
  options?: DragSessionOptions,
) {
  const items = useCanvasItemsStore.getState().items
  const item = items.find((entry) => entry.id === itemId)
  if (!item) return

  const pointerCanvas = clientToCanvasFromElementForItem(clientX, clientY, canvasEl)
  if (!pointerCanvas) return

  finishSession()

  const origin = itemCanvasOrigin(item)

  session = {
    itemId,
    pointerId,
    phase: 'pending',
    canvasEl,
    grabOffsetX: pointerCanvas.x - origin.x,
    grabOffsetY: pointerCanvas.y - origin.y,
    startClientX: clientX,
    startClientY: clientY,
    lastClientX: clientX,
    lastClientY: clientY,
    dragThresholdPx: options?.dragThresholdPx ?? DRAG_THRESHOLD_PX,
    moved: false,
    dragStartX: item.x,
    dragStartY: item.y,
    onReleaseWithoutDrag: options?.onReleaseWithoutDrag,
  }

  setPointerSessionActive(true)
  installDragSessionListeners(pointerId)
}

function installDragSessionListeners(pointerId: number) {
  removeDocumentListeners()

  const onPointerMove = (e: PointerEvent) => {
    if (!session || e.pointerId !== pointerId) return

    if (primaryPointerReleased(e, pointerId)) {
      session.lastClientX = e.clientX
      session.lastClientY = e.clientY
      finishSession()
      return
    }

    if (useCanvasNavigationStore.getState().shouldSuppressHandleGesture()) {
      finishSession()
      return
    }

    if (session.phase === 'pending') {
      if (
        screenDist(e.clientX, e.clientY, session.startClientX, session.startClientY) <
        session.dragThresholdPx
      ) {
        return
      }
      commitDragStart()
    }

    if (e.cancelable) e.preventDefault()
    scheduleDragMove(e.clientX, e.clientY)
  }

  const onPointerEnd = (e: PointerEvent) => {
    if (!session || e.pointerId !== pointerId) return
    if (e.type === 'pointercancel' && isTouchPointerStillActive(pointerId)) {
      return
    }
    session.lastClientX = e.clientX
    session.lastClientY = e.clientY
    finishSession()
  }

  document.addEventListener('pointermove', onPointerMove, { capture: true })
  document.addEventListener('pointerup', onPointerEnd, { capture: true })
  document.addEventListener('pointercancel', onPointerEnd, { capture: true })
  window.addEventListener('pointerup', onPointerEnd, { capture: true })
  window.addEventListener('pointercancel', onPointerEnd, { capture: true })
  window.addEventListener('blur', finishSession)

  const onWindowMouseMove = (e: MouseEvent) => {
    if (!session || session.pointerId !== pointerId) return
    if (primaryPointerReleased(e, pointerId)) {
      session.lastClientX = e.clientX
      session.lastClientY = e.clientY
      finishSession()
    }
  }
  window.addEventListener('mousemove', onWindowMouseMove, { capture: true })

  detachListeners = () => {
    document.removeEventListener('pointermove', onPointerMove, true)
    document.removeEventListener('pointerup', onPointerEnd, true)
    document.removeEventListener('pointercancel', onPointerEnd, true)
    window.removeEventListener('pointerup', onPointerEnd, true)
    window.removeEventListener('pointercancel', onPointerEnd, true)
    window.removeEventListener('blur', finishSession)
    window.removeEventListener('mousemove', onWindowMouseMove, true)
  }
}

/**
 * Attach drag tracking to a pointer that is already down (e.g. after hold-to-select).
 */
export function attachCanvasItemDragContinuingPointer(
  itemId: string,
  pointerId: number,
  canvasEl: HTMLElement,
  clientX: number,
  clientY: number,
  options?: DragSessionOptions,
) {
  if (!canvasEditingAllowed()) return
  if (
    useCanvasNavigationStore.getState().shouldSuppressHandleGesture()
  ) {
    return
  }

  startDragSession(itemId, pointerId, canvasEl, clientX, clientY, {
    ...options,
    dragThresholdPx: options?.dragThresholdPx ?? 0,
  })
  commitDragStart()
  applyDragPosition(clientX, clientY)
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
  if (!canvasEditingAllowed()) return
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

  event.preventDefault()
  event.stopPropagation()

  startDragSession(
    itemId,
    event.pointerId,
    canvasEl,
    event.clientX,
    event.clientY,
    options,
  )
}

export function cancelCanvasItemDrag() {
  clearAllDropState()
  finishSession()
}

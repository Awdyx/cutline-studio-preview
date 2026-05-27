import { useCallback, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { useCanvasNavigationStore } from './canvasNavigationStore'
import {
  dismissSelectionForOutsideItemTap,
  shouldSkipItemSelectForOutsideDismiss,
} from './canvasSelectionDismiss'
import {
  CANVAS_TAP_MOVE_THRESHOLD_PX,
  watchPendingTouchTap,
} from './pointerTapGesture'
import {
  attachCanvasItemDragContinuingPointer,
  clearHoldDragPanExclude,
} from '../canvasItems/canvasItemDrag'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'

import { useCanvasItemDragStore } from '../canvasItems/canvasItemDragStore'

/** Hold still on an unselected item this long to select and arm drag on the same pointer. */
export const CANVAS_ITEM_HOLD_SELECT_MS = 450

export function handleCanvasItemRightClickSelect(
  itemId: string,
  event: ReactPointerEvent<HTMLElement>,
  { frozen }: { frozen: boolean },
) {
  if (frozen || event.pointerType === 'pen') return
  if (event.pointerType === 'mouse' && event.button !== 2) return
  if (useCanvasNavigationStore.getState().shouldSuppressItemTap()) return

  event.preventDefault()
  event.stopPropagation()

  if (useCanvasItemsStore.getState().zMenuSuppressedItemId === itemId) {
    useCanvasItemsStore.getState().clearMenuFocusChrome()
  }

  useCanvasItemsStore.getState().selectItem(itemId, event.shiftKey)
  event.currentTarget.classList.add('canvas-item-selected-focus')
}

const HOLD_DRAG_PAN_EXCLUDE_CLASS = 'canvas-item-hold-drag-pending'

function capturePointerOnBody(pointerId: number) {
  try {
    document.body.setPointerCapture(pointerId)
  } catch {
    // ignore
  }
}

function releasePointerFromBody(pointerId: number) {
  try {
    if (document.body.hasPointerCapture(pointerId)) {
      document.body.releasePointerCapture(pointerId)
    }
  } catch {
    // ignore
  }
}

function resolveCanvasEl(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  const canvas = target.closest('.cutline-draw-target')
  return canvas instanceof HTMLElement ? canvas : null
}

export function useCanvasItemAreaPointer({
  itemId,
  isSelected,
  frozen,
  moveBlocked,
  onGrabPointerDown,
  onPrimaryActivate,
}: {
  itemId: string
  isSelected: boolean
  frozen: boolean
  moveBlocked: boolean
  onGrabPointerDown: (
    e: React.PointerEvent<HTMLElement>,
    options?: { onReleaseWithoutDrag?: () => void },
  ) => void
  /** Replaces tap/hold select and body drag — study hubs use menu-focus on primary tap. */
  onPrimaryActivate?: (e: React.PointerEvent<HTMLElement>) => void
}) {
  const holdTimerRef = useRef<number | null>(null)
  const tapCancelRef = useRef<(() => void) | null>(null)
  const holdEngagedRef = useRef(false)
  const holdCleanupRef = useRef<(() => void) | null>(null)
  const holdTargetRef = useRef<HTMLElement | null>(null)
  const holdPointerIdRef = useRef<number | null>(null)
  const lastPointerRef = useRef({ x: 0, y: 0 })
  const selectItem = useCanvasItemsStore((s) => s.selectItem)

  const clearHoldGesture = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    holdCleanupRef.current?.()
    holdCleanupRef.current = null
    holdEngagedRef.current = false
    holdTargetRef.current?.classList.remove(HOLD_DRAG_PAN_EXCLUDE_CLASS)
    holdTargetRef.current = null
    const pointerId = holdPointerIdRef.current
    holdPointerIdRef.current = null
    if (
      pointerId != null &&
      !useCanvasItemDragStore.getState().pointerSessionActive
    ) {
      releasePointerFromBody(pointerId)
    }
  }, [])

  const resetHold = useCallback(() => {
    tapCancelRef.current?.()
    tapCancelRef.current = null
    clearHoldGesture()
  }, [clearHoldGesture])

  const selectThis = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (dismissSelectionForOutsideItemTap(itemId)) return
      selectItem(itemId, e.shiftKey)
      e.currentTarget.classList.add('canvas-item-selected-focus')
    },
    [itemId, selectItem],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (frozen || e.pointerType === 'pen') return

      if (e.pointerType === 'mouse' && e.button === 2) {
        handleCanvasItemRightClickSelect(itemId, e, { frozen })
        return
      }

      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (useCanvasNavigationStore.getState().shouldSuppressItemTap()) return

      if (isSelected) {
        if (useCanvasItemsStore.getState().zMenuSuppressedItemId === itemId) {
          useCanvasItemsStore.getState().clearMenuFocusChrome()
        }
        if (!moveBlocked) onGrabPointerDown(e)
        return
      }

      if (onPrimaryActivate) {
        if (shouldSkipItemSelectForOutsideDismiss(itemId)) {
          e.stopPropagation()
          dismissSelectionForOutsideItemTap(itemId)
          return
        }

        resetHold()
        e.stopPropagation()

        const target = e.currentTarget
        target.classList.add(HOLD_DRAG_PAN_EXCLUDE_CLASS)
        holdTargetRef.current = target

        const pointerId = e.pointerId
        const startX = e.clientX
        const startY = e.clientY
        lastPointerRef.current = { x: startX, y: startY }
        holdPointerIdRef.current = pointerId
        capturePointerOnBody(pointerId)

        const cancelHoldTimer = () => {
          if (holdTimerRef.current !== null) {
            window.clearTimeout(holdTimerRef.current)
            holdTimerRef.current = null
          }
        }

        const cleanupHoldWatch = () => {
          cancelHoldTimer()
          holdCleanupRef.current?.()
          holdCleanupRef.current = null
        }

        const onHoldMove = (ev: PointerEvent) => {
          if (ev.pointerId !== pointerId) return
          lastPointerRef.current = { x: ev.clientX, y: ev.clientY }
          if (
            Math.hypot(ev.clientX - startX, ev.clientY - startY) >
            CANVAS_TAP_MOVE_THRESHOLD_PX
          ) {
            cleanupHoldWatch()
            target.classList.remove(HOLD_DRAG_PAN_EXCLUDE_CLASS)
            holdTargetRef.current = null
            releasePointerFromBody(pointerId)
            holdPointerIdRef.current = null
          }
        }

        const onHoldEnd = (ev: PointerEvent) => {
          if (ev.pointerId !== pointerId) return
          cleanupHoldWatch()
          if (!holdEngagedRef.current) {
            target.classList.remove(HOLD_DRAG_PAN_EXCLUDE_CLASS)
            holdTargetRef.current = null
            releasePointerFromBody(pointerId)
          }
        }

        window.addEventListener('pointermove', onHoldMove)
        window.addEventListener('pointerup', onHoldEnd)
        window.addEventListener('pointercancel', onHoldEnd)
        holdCleanupRef.current = () => {
          window.removeEventListener('pointermove', onHoldMove)
          window.removeEventListener('pointerup', onHoldEnd)
          window.removeEventListener('pointercancel', onHoldEnd)
        }

        holdTimerRef.current = window.setTimeout(() => {
          holdTimerRef.current = null
          holdEngagedRef.current = true
          tapCancelRef.current?.()
          tapCancelRef.current = null
          cleanupHoldWatch()

          const { x, y } = lastPointerRef.current
          const canvasEl = resolveCanvasEl(target)

          if (!moveBlocked && canvasEl) {
            releasePointerFromBody(pointerId)
            attachCanvasItemDragContinuingPointer(
              itemId,
              pointerId,
              canvasEl,
              x,
              y,
            )
            holdPointerIdRef.current = null
          } else {
            releasePointerFromBody(pointerId)
            holdPointerIdRef.current = null
          }

          if (!shouldSkipItemSelectForOutsideDismiss(itemId)) {
            selectItem(itemId, e.shiftKey)
            target.classList.add('canvas-item-selected-focus')
          }

          target.classList.remove(HOLD_DRAG_PAN_EXCLUDE_CLASS)
          holdTargetRef.current = null
        }, CANVAS_ITEM_HOLD_SELECT_MS)

        tapCancelRef.current = watchPendingTouchTap({
          pointerId,
          startX,
          startY,
          onComplete: () => {
            if (holdEngagedRef.current) return
            onPrimaryActivate(e)
            tapCancelRef.current = null
            clearHoldGesture()
          },
          onCancel: () => {
            resetHold()
            clearHoldDragPanExclude()
          },
        })
        return
      }

      if (shouldSkipItemSelectForOutsideDismiss(itemId)) {
        e.stopPropagation()
        if (useCanvasNavigationStore.getState().shouldSuppressItemTap()) return

        if (e.pointerType === 'mouse') {
          dismissSelectionForOutsideItemTap(itemId)
          return
        }

        if (e.pointerType === 'touch') {
          resetHold()
          tapCancelRef.current = watchPendingTouchTap({
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            onComplete: () => {
              dismissSelectionForOutsideItemTap(itemId)
              tapCancelRef.current = null
            },
            onCancel: () => {
              resetHold()
              clearHoldDragPanExclude()
            },
          })
        }
        return
      }

      resetHold()

      e.stopPropagation()

      const target = e.currentTarget
      target.classList.add(HOLD_DRAG_PAN_EXCLUDE_CLASS)
      holdTargetRef.current = target

      const pointerId = e.pointerId
      const startX = e.clientX
      const startY = e.clientY
      lastPointerRef.current = { x: startX, y: startY }
      holdPointerIdRef.current = pointerId
      capturePointerOnBody(pointerId)

      if (e.pointerType === 'mouse') {
        selectThis(e)
      }

      const cancelHoldTimer = () => {
        if (holdTimerRef.current !== null) {
          window.clearTimeout(holdTimerRef.current)
          holdTimerRef.current = null
        }
      }

      const cleanupHoldWatch = () => {
        cancelHoldTimer()
        holdCleanupRef.current?.()
        holdCleanupRef.current = null
      }

      const onHoldMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return
        lastPointerRef.current = { x: ev.clientX, y: ev.clientY }
        if (
          Math.hypot(ev.clientX - startX, ev.clientY - startY) >
          CANVAS_TAP_MOVE_THRESHOLD_PX
        ) {
          cleanupHoldWatch()
          target.classList.remove(HOLD_DRAG_PAN_EXCLUDE_CLASS)
          holdTargetRef.current = null
          releasePointerFromBody(pointerId)
          holdPointerIdRef.current = null
        }
      }

      const onHoldEnd = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return
        cleanupHoldWatch()
        if (!holdEngagedRef.current) {
          target.classList.remove(HOLD_DRAG_PAN_EXCLUDE_CLASS)
          holdTargetRef.current = null
          releasePointerFromBody(pointerId)
        }
      }

      window.addEventListener('pointermove', onHoldMove)
      window.addEventListener('pointerup', onHoldEnd)
      window.addEventListener('pointercancel', onHoldEnd)
      holdCleanupRef.current = () => {
        window.removeEventListener('pointermove', onHoldMove)
        window.removeEventListener('pointerup', onHoldEnd)
        window.removeEventListener('pointercancel', onHoldEnd)
      }

      holdTimerRef.current = window.setTimeout(() => {
        holdTimerRef.current = null
        holdEngagedRef.current = true
        tapCancelRef.current?.()
        tapCancelRef.current = null
        cleanupHoldWatch()

        const { x, y } = lastPointerRef.current
        const canvasEl = resolveCanvasEl(target)

        if (!moveBlocked && canvasEl) {
          releasePointerFromBody(pointerId)
          attachCanvasItemDragContinuingPointer(
            itemId,
            pointerId,
            canvasEl,
            x,
            y,
          )
          holdPointerIdRef.current = null
        } else {
          releasePointerFromBody(pointerId)
          holdPointerIdRef.current = null
        }

        if (!shouldSkipItemSelectForOutsideDismiss(itemId)) {
          selectItem(itemId, e.shiftKey)
          target.classList.add('canvas-item-selected-focus')
        }

        target.classList.remove(HOLD_DRAG_PAN_EXCLUDE_CLASS)
        holdTargetRef.current = null
      }, CANVAS_ITEM_HOLD_SELECT_MS)

      tapCancelRef.current = watchPendingTouchTap({
        pointerId,
        startX,
        startY,
        onComplete: () => {
          if (holdEngagedRef.current) return
          selectThis(e)
          tapCancelRef.current = null
          clearHoldGesture()
        },
        onCancel: () => {
          resetHold()
          clearHoldDragPanExclude()
        },
      })
    },
    [
      frozen,
      isSelected,
      itemId,
      moveBlocked,
      onGrabPointerDown,
      resetHold,
      selectThis,
      clearHoldGesture,
      onPrimaryActivate,
    ],
  )

  const onPointerUp = useCallback(() => {
    // Window-level tap tracking completes or cancels selection.
  }, [])

  const onPointerCancel = useCallback(() => {
    // Window-level tap tracking completes or cancels selection.
  }, [])

  const onContextMenu = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    e.preventDefault()
  }, [])

  return {
    onPointerDown,
    onPointerMove: () => {},
    onPointerUp,
    onPointerCancel,
    onContextMenu,
  }
}

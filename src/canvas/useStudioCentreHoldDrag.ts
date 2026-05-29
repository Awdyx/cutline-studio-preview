import { useCallback, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { useCanvasFisheyeStore } from './canvasFisheyeStore'
import {
  CANVAS_TAP_MOVE_THRESHOLD_PX,
  watchPendingTouchTap,
} from './pointerTapGesture'
import { runCanvasFisheyeExit } from './canvasBarrelPostProcess'
import {
  startStudioCentreDragAtScreen,
  STUDIO_CENTRE_HOLD_DRAG_PAN_EXCLUDE_CLASS,
} from './studioCentreDrag'
import { useStudioCentreDragStore } from './studioCentreDragStore'

/** Hold still on the studio surface this long to arm drag on the same pointer. */
export const STUDIO_CENTRE_HOLD_DRAG_MS = 450

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

export function useStudioCentreHoldDrag(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
) {
  const engaged = useCanvasFisheyeStore((s) => s.engaged)
  const holdTimerRef = useRef<number | null>(null)
  const holdTargetRef = useRef<HTMLElement | null>(null)
  const holdPointerIdRef = useRef<number | null>(null)
  const holdEngagedRef = useRef(false)
  const holdCleanupRef = useRef<(() => void) | null>(null)
  const tapCancelRef = useRef<(() => void) | null>(null)
  const lastPointerRef = useRef({ x: 0, y: 0 })

  const clearHold = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    holdCleanupRef.current?.()
    holdCleanupRef.current = null
    tapCancelRef.current?.()
    tapCancelRef.current = null
    holdEngagedRef.current = false
    holdTargetRef.current?.classList.remove(STUDIO_CENTRE_HOLD_DRAG_PAN_EXCLUDE_CLASS)
    holdTargetRef.current = null
    const pointerId = holdPointerIdRef.current
    holdPointerIdRef.current = null
    if (pointerId != null) releasePointerFromBody(pointerId)
    if (!holdEngagedRef.current) {
      useStudioCentreDragStore.getState().setPanSuppressed(false)
    }
  }, [])

  const onSurfacePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!engaged) return
      if (event.pointerType === 'pen') return
      if (event.pointerType === 'mouse' && event.button !== 0) return

      event.preventDefault()
      event.stopPropagation()

      clearHold()

      const target = event.currentTarget
      target.classList.add(STUDIO_CENTRE_HOLD_DRAG_PAN_EXCLUDE_CLASS)
      holdTargetRef.current = target
      holdPointerIdRef.current = event.pointerId
      useStudioCentreDragStore.getState().setPanSuppressed(true)

      const pointerId = event.pointerId
      const startX = event.clientX
      const startY = event.clientY
      lastPointerRef.current = { x: startX, y: startY }

      capturePointerOnBody(pointerId)

      tapCancelRef.current = watchPendingTouchTap({
        pointerId,
        startX,
        startY,
        onComplete: () => {
          tapCancelRef.current = null
          runCanvasFisheyeExit(transformRef.current, { x: startX, y: startY })
        },
        onCancel: () => {
          tapCancelRef.current = null
        },
      })

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
          !holdEngagedRef.current &&
          Math.hypot(ev.clientX - startX, ev.clientY - startY) >
            CANVAS_TAP_MOVE_THRESHOLD_PX
        ) {
          cleanupHoldWatch()
          target.classList.remove(STUDIO_CENTRE_HOLD_DRAG_PAN_EXCLUDE_CLASS)
          holdTargetRef.current = null
          useStudioCentreDragStore.getState().setPanSuppressed(false)
          releasePointerFromBody(pointerId)
          holdPointerIdRef.current = null
        }
      }

      const onHoldEnd = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return
        cleanupHoldWatch()
        if (!holdEngagedRef.current) {
          target.classList.remove(STUDIO_CENTRE_HOLD_DRAG_PAN_EXCLUDE_CLASS)
          holdTargetRef.current = null
          useStudioCentreDragStore.getState().setPanSuppressed(false)
          releasePointerFromBody(pointerId)
          holdPointerIdRef.current = null
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
        releasePointerFromBody(pointerId)
        startStudioCentreDragAtScreen(transformRef, pointerId, x, y, {
          dragThresholdPx: 0,
        })
      }, STUDIO_CENTRE_HOLD_DRAG_MS)
    },
    [clearHold, engaged, transformRef],
  )

  return {
    onSurfacePointerDown,
  }
}

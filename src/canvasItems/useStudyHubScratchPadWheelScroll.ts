import { useEffect, type RefObject } from 'react'
import { isPenInput, isPenTouch } from '../drawing/penInput'
import { applyScratchPadScrollDelta } from './studyHubScratchPadScroll'

const SCRATCH_PAD_SCROLL_LOCK_ATTR = 'data-scratch-pad-scroll-locked'
const SCRATCH_PAD_DRAWING_ATTR = 'data-scratch-pad-drawing'

function wheelDeltaPixels(event: WheelEvent, pageHeight: number): number {
  let dy = event.deltaY
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) dy *= 16
  else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) dy *= pageHeight
  return dy
}

function touchListHasPen(touches: TouchList): boolean {
  return [...touches].some(isPenTouch)
}

/** Trackpad wheel on the pad; finger uses native pan-y; Pencil must not scroll. */
export function useStudyHubScratchPadWheelScroll(
  scrollRef: RefObject<HTMLElement | null>,
  active: boolean,
) {
  useEffect(() => {
    const host = scrollRef.current
    if (!host || !active) return

    function isActivelyDrawing(): boolean {
      return host.querySelector(`[${SCRATCH_PAD_DRAWING_ATTR}]`) != null
    }

    function syncPenScrollLock(touches: TouchList) {
      if (touchListHasPen(touches)) {
        host.setAttribute(SCRATCH_PAD_SCROLL_LOCK_ATTR, '')
      } else if (!isActivelyDrawing()) {
        host.removeAttribute(SCRATCH_PAD_SCROLL_LOCK_ATTR)
      }
    }

    function applyWheelScroll(event: WheelEvent) {
      if (event.ctrlKey || event.metaKey) return
      if (isActivelyDrawing()) return

      const dy = wheelDeltaPixels(event, host.clientHeight)
      if (dy === 0 && event.deltaX === 0) return

      event.preventDefault()
      event.stopPropagation()
      applyScratchPadScrollDelta(host, dy)
    }

    function onTouchStart(event: TouchEvent) {
      syncPenScrollLock(event.touches)
    }

    function onTouchMove(event: TouchEvent) {
      if (!touchListHasPen(event.touches)) return
      if (event.cancelable) event.preventDefault()
    }

    function onTouchEnd(event: TouchEvent) {
      syncPenScrollLock(event.touches)
    }

    function onPointerDown(event: PointerEvent) {
      if (event.pointerType === 'pen' || isPenInput(event)) {
        host.setAttribute(SCRATCH_PAD_SCROLL_LOCK_ATTR, '')
      }
    }

    function onPointerUp(event: PointerEvent) {
      if (event.pointerType !== 'pen' && !isPenInput(event)) return
      if (!isActivelyDrawing()) {
        host.removeAttribute(SCRATCH_PAD_SCROLL_LOCK_ATTR)
      }
    }

    host.addEventListener('wheel', applyWheelScroll, { passive: false })
    host.addEventListener('pointerdown', onPointerDown, { capture: true })
    host.addEventListener('pointerup', onPointerUp, { capture: true })
    host.addEventListener('pointercancel', onPointerUp, { capture: true })
    host.addEventListener('touchstart', onTouchStart, { capture: true, passive: true })
    host.addEventListener('touchmove', onTouchMove, { capture: true, passive: false })
    host.addEventListener('touchend', onTouchEnd, { capture: true, passive: true })
    host.addEventListener('touchcancel', onTouchEnd, { capture: true, passive: true })

    return () => {
      host.removeAttribute(SCRATCH_PAD_SCROLL_LOCK_ATTR)
      host.removeEventListener('wheel', applyWheelScroll)
      host.removeEventListener('pointerdown', onPointerDown, true)
      host.removeEventListener('pointerup', onPointerUp, true)
      host.removeEventListener('pointercancel', onPointerUp, true)
      host.removeEventListener('touchstart', onTouchStart, true)
      host.removeEventListener('touchmove', onTouchMove, true)
      host.removeEventListener('touchend', onTouchEnd, true)
      host.removeEventListener('touchcancel', onTouchEnd, true)
    }
  }, [scrollRef, active])
}

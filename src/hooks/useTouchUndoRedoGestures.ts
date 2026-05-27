import { useEffect, type RefObject } from 'react'
import { isFingerTouch, isStylusTouch } from '../drawing/penInput'
import type { PenToolMenuBridge } from '../drawing/usePenToolMenu'
import { useStrokesStore } from '../drawing/strokesStore'
import { SHORTCUTS_BY_ID } from '../shortcuts/shortcutDefs'
import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'

/** Movement above this cancels a multi-finger tap (pan/pinch). */
const TAP_MOVE_THRESHOLD_PX = 15
/** Max time from first finger down to last finger up. */
const MAX_TAP_DURATION_MS = 400
/** Ignore repeat triggers from the same gesture. */
const GESTURE_COOLDOWN_MS = 350

type TouchSession = {
  maxFingerCount: number
  startTime: number
  startPositions: Map<number, { x: number; y: number }>
  maxMovement: number
  hadStylus: boolean
}

function isEditableFocused(): boolean {
  const el = document.activeElement
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
}

function fireToast(shortcutId: string) {
  const def = SHORTCUTS_BY_ID[shortcutId]
  if (!def || def.skipToast) return
  useShortcutUiStore.getState().showActionToast({
    shortcutId,
    label: def.label,
    keys: def.keys,
    icon: def.icon,
  })
}

function fingerTouches(touchList: TouchList): Touch[] {
  return Array.from(touchList).filter(isFingerTouch)
}

function touchesIncludeStylus(touchList: TouchList): boolean {
  return Array.from(touchList).some(isStylusTouch)
}

function recordStartPositions(
  session: TouchSession,
  touches: Touch[],
) {
  for (const touch of touches) {
    if (!session.startPositions.has(touch.identifier)) {
      session.startPositions.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY,
      })
    }
  }
}

function updateMaxMovement(session: TouchSession, touches: Touch[]) {
  for (const touch of touches) {
    const start = session.startPositions.get(touch.identifier)
    if (!start) continue
    const movement = Math.hypot(
      touch.clientX - start.x,
      touch.clientY - start.y,
    )
    session.maxMovement = Math.max(session.maxMovement, movement)
  }
}

export function useTouchUndoRedoGestures(
  penMenuBridgeRef?: RefObject<PenToolMenuBridge | null>,
) {
  useEffect(() => {
    let session: TouchSession | null = null
    let lastTriggerAt = 0

    function resetSession() {
      session = null
    }

    function penMenuActive(): boolean {
      return penMenuBridgeRef?.current?.isActive() ?? false
    }

    function onTouchStart(event: TouchEvent) {
      if (touchesIncludeStylus(event.touches)) {
        if (session) session.hadStylus = true
        return
      }

      const fingers = fingerTouches(event.touches)
      if (fingers.length === 0) return

      if (!session) {
        session = {
          maxFingerCount: fingers.length,
          startTime: performance.now(),
          startPositions: new Map(),
          maxMovement: 0,
          hadStylus: false,
        }
        recordStartPositions(session, fingers)
        return
      }

      session.maxFingerCount = Math.max(session.maxFingerCount, fingers.length)
      recordStartPositions(session, fingers)
    }

    function onTouchMove(event: TouchEvent) {
      if (!session || session.hadStylus) return
      if (touchesIncludeStylus(event.touches)) {
        session.hadStylus = true
        return
      }

      updateMaxMovement(session, fingerTouches(event.touches))
      if (session.maxMovement > TAP_MOVE_THRESHOLD_PX) {
        resetSession()
      }
    }

    function onTouchEnd(event: TouchEvent) {
      if (touchesIncludeStylus(event.changedTouches)) {
        if (session) session.hadStylus = true
      }

      if (!session) return

      const remaining = fingerTouches(event.touches)
      if (remaining.length > 0) return

      const ended = session
      resetSession()

      if (ended.hadStylus) return
      if (ended.maxFingerCount !== 2 && ended.maxFingerCount !== 3) return
      if (ended.maxMovement > TAP_MOVE_THRESHOLD_PX) return

      const duration = performance.now() - ended.startTime
      if (duration > MAX_TAP_DURATION_MS) return

      const now = performance.now()
      if (now - lastTriggerAt < GESTURE_COOLDOWN_MS) return
      if (isEditableFocused()) return
      if (penMenuActive()) return

      lastTriggerAt = now
      event.preventDefault()

      if (ended.maxFingerCount === 2) {
        if (useStrokesStore.getState().undo()) fireToast('undo')
      } else {
        if (useStrokesStore.getState().redo()) fireToast('redo')
      }
    }

    const opts = { capture: true, passive: false } as const
    window.addEventListener('touchstart', onTouchStart, opts)
    window.addEventListener('touchmove', onTouchMove, opts)
    window.addEventListener('touchend', onTouchEnd, opts)
    window.addEventListener('touchcancel', onTouchEnd, opts)

    return () => {
      window.removeEventListener('touchstart', onTouchStart, opts)
      window.removeEventListener('touchmove', onTouchMove, opts)
      window.removeEventListener('touchend', onTouchEnd, opts)
      window.removeEventListener('touchcancel', onTouchEnd, opts)
    }
  }, [penMenuBridgeRef])
}

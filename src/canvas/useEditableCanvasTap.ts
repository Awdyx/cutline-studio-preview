import { useCallback, useRef } from 'react'
import { useCanvasNavigationStore } from './canvasNavigationStore'
import { watchPendingTouchTap } from './pointerTapGesture'

type TapPhase = 'idle' | 'pending'

/**
 * Tap handling for contentEditable canvas items.
 * Touch: focus on pointerdown for iOS keyboard, select on pointerup if not a pan/pinch.
 * Mouse: immediate select + focus on pointerdown.
 */
export function useEditableCanvasTap(options: {
  onTap: (event: React.PointerEvent) => void
  onFocus: () => void
  onPanCancel?: () => void
  /** When true, touch pointerdown focuses immediately (already editing). */
  focusOnTouchStart?: () => boolean
}) {
  const { onTap, onFocus, onPanCancel, focusOnTouchStart } = options
  const phaseRef = useRef<TapPhase>('idle')
  const cancelWatchRef = useRef<(() => void) | null>(null)
  const pendingEventRef = useRef<React.PointerEvent | null>(null)

  const reset = useCallback(() => {
    cancelWatchRef.current?.()
    cancelWatchRef.current = null
    pendingEventRef.current = null
    phaseRef.current = 'idle'
  }, [])

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.pointerType === 'pen') return

      if (event.pointerType === 'mouse') {
        if (useCanvasNavigationStore.getState().shouldSuppressItemTap()) return
        onTap(event)
        event.stopPropagation()
        return
      }

      if (event.pointerType !== 'touch') return

      reset()
      if (focusOnTouchStart?.()) {
        onFocus()
      }

      phaseRef.current = 'pending'
      pendingEventRef.current = event

      cancelWatchRef.current = watchPendingTouchTap({
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        onComplete: () => {
          const pending = pendingEventRef.current
          reset()
          if (pending) onTap(pending)
        },
        onCancel: () => {
          onPanCancel?.()
          reset()
        },
      })
    },
    [focusOnTouchStart, onFocus, onPanCancel, onTap, reset],
  )

  const onPointerMove = useCallback(() => {
    // Window-level tracking handles pan cancellation.
  }, [])

  const onPointerUp = useCallback(() => {
    // Window-level tracking completes or cancels the tap.
  }, [])

  const onPointerCancel = useCallback(() => {
    onPanCancel?.()
    reset()
  }, [onPanCancel, reset])

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
}

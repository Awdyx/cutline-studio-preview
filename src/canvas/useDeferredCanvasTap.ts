import { useCallback, useRef } from 'react'
import { useCanvasNavigationStore } from './canvasNavigationStore'
import { watchPendingTouchTap } from './pointerTapGesture'

type TapPhase = 'idle' | 'pending'

/**
 * Defers touch taps until pointerup so finger pans/pinches do not select or focus.
 * Mouse keeps immediate pointerdown behavior.
 */
export function useDeferredCanvasTap(onTap: (event: React.PointerEvent) => void) {
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
        if (event.button !== 0) return
        if (useCanvasNavigationStore.getState().shouldSuppressItemTap()) return
        onTap(event)
        return
      }

      if (event.pointerType !== 'touch') return

      reset()
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
        onCancel: reset,
      })
    },
    [onTap, reset],
  )

  const onPointerMove = useCallback(() => {
    // Window-level tracking handles pan cancellation.
  }, [])

  const onPointerUp = useCallback(() => {
    // Window-level tracking completes or cancels the tap.
  }, [])

  const onPointerCancel = useCallback(() => {
    reset()
  }, [reset])

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
}

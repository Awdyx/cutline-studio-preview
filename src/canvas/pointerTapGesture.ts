import { useCanvasNavigationStore } from './canvasNavigationStore'

/** Movement above this is treated as pan/navigation, not a tap. */
export const CANVAS_TAP_MOVE_THRESHOLD_PX = 10

type TapWatchOptions = {
  pointerId: number
  startX: number
  startY: number
  onComplete: () => void
  onCancel?: () => void
}

/**
 * Track a pending touch tap on window so canvas pan/pinch movement cancels selection
 * even when the target element never receives pointermove.
 */
export function watchPendingTouchTap({
  pointerId,
  startX,
  startY,
  onComplete,
  onCancel,
}: TapWatchOptions): () => void {
  let cancelled = false

  const cleanup = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onEnd)
    window.removeEventListener('pointercancel', onEnd)
  }

  const cancel = () => {
    if (cancelled) return
    cancelled = true
    onCancel?.()
    cleanup()
  }

  const onMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    const dx = event.clientX - startX
    const dy = event.clientY - startY
    if (Math.hypot(dx, dy) > CANVAS_TAP_MOVE_THRESHOLD_PX) {
      cancel()
    }
  }

  const onEnd = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    cleanup()
    if (cancelled) return
    if (useCanvasNavigationStore.getState().shouldSuppressItemTap()) return
    onComplete()
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onEnd)
  window.addEventListener('pointercancel', onEnd)

  return cancel
}

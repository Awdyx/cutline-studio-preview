import { useEffect, type RefObject } from 'react'
import { usePanMotionStore } from '../panMotionStore'

/** Keep wheel / trackpad scroll inside a canvas item instead of panning the canvas. */
export function useCanvasItemScrollCapture(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    function onWheel(event: WheelEvent) {
      if (usePanMotionStore.getState().canvasPanActive) {
        event.preventDefault()
        return
      }
      event.stopPropagation()
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [ref])
}

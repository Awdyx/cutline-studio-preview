import { useCallback } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { attachCanvasItemDragPointerDown } from './canvasItemDrag'
import { useCanvasItemDragStore } from './canvasItemDragStore'

export function useCanvasItemDrag(itemId: string) {
  const activeItemId = useCanvasItemDragStore((s) => s.activeItemId)
  const isDragging = activeItemId === itemId

  const onGrabPointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      options?: { onReleaseWithoutDrag?: () => void },
    ) => {
      attachCanvasItemDragPointerDown(itemId, event, options)
    },
    [itemId],
  )

  return { isDragging, onGrabPointerDown }
}

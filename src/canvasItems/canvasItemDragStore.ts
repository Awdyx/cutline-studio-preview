import { create } from 'zustand'

/** Item currently being moved (after drag threshold). Drives lift UI and temporary pan lock. */
export const useCanvasItemDragStore = create<{
  activeItemId: string | null
  /** True while a pointer is down on an item drag session (pending or dragging). */
  pointerSessionActive: boolean
  /** Brief pulse when an item snaps back into the studio centre. */
  boundsSnapBackItemId: string | null
  boundsSnapBackNonce: number
}>(() => ({
  activeItemId: null,
  pointerSessionActive: false,
  boundsSnapBackItemId: null,
  boundsSnapBackNonce: 0,
}))

export function triggerBoundsSnapBack(itemId: string) {
  useCanvasItemDragStore.setState({
    boundsSnapBackItemId: itemId,
    boundsSnapBackNonce: Date.now(),
  })
  window.setTimeout(() => {
    if (useCanvasItemDragStore.getState().boundsSnapBackItemId === itemId) {
      useCanvasItemDragStore.setState({ boundsSnapBackItemId: null })
    }
  }, 260)
}

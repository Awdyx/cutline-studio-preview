import { create } from 'zustand'

/** Item currently being moved (after drag threshold). Drives lift UI and temporary pan lock. */
export const useCanvasItemDragStore = create<{
  activeItemId: string | null
  /** True while a pointer is down on an item drag session (pending or dragging). */
  pointerSessionActive: boolean
}>(() => ({
  activeItemId: null,
  pointerSessionActive: false,
}))

import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'

/** True when the pointer target is on a currently selected canvas item (body or handles). */
export function isPointerOnSelectedItem(
  target: EventTarget | null,
  selectedIds: readonly string[],
): boolean {
  if (selectedIds.length === 0) return false
  if (!(target instanceof Element)) return false

  const itemEl = target.closest('[data-item-id]')
  if (!itemEl) return false

  const itemId = itemEl.getAttribute('data-item-id')
  return itemId != null && selectedIds.includes(itemId)
}

/** Item tap handlers skip selection when another item is selected — canvas dismisses instead. */
export function shouldSkipItemSelectForOutsideDismiss(itemId: string): boolean {
  const { selectedIds } = useCanvasItemsStore.getState()
  return selectedIds.length > 0 && !selectedIds.includes(itemId)
}

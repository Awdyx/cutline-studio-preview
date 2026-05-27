import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { useLassoStore } from '../drawing/useLassoStore'
import { useCanvasNavigationStore } from './canvasNavigationStore'

/** True when the pointer target is on a space card preview for the given space id. */
export function isPointerOnSpacePreview(
  target: EventTarget | null,
  spaceId: string,
): boolean {
  if (!(target instanceof Element)) return false

  const preview = target.closest('[data-space-preview]')
  if (!preview) return false

  const itemEl = preview.closest('[data-item-id]')
  return itemEl?.getAttribute('data-item-id') === spaceId
}

/** True when the pointer target is on any canvas item shell. */
export function isPointerOnCanvasItem(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return target.closest('[data-item-id]') != null
}

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

/** True when the pointer target is on the floating z-order menu for the selection. */
export function isPointerOnCanvasItemZMenu(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return target.closest('[data-canvas-item-z-menu]') != null
}

/** True when a tap outside the current selection should clear it. */
export function shouldDismissSelectionForPointer(
  target: EventTarget | null,
  selectedIds: readonly string[],
): boolean {
  if (selectedIds.length === 0) return false
  if (isPointerOnCanvasItemZMenu(target)) return false
  return !isPointerOnSelectedItem(target, selectedIds)
}

/** Clear canvas item or lasso selection. */
export function dismissCanvasSelection(): void {
  const lasso = useLassoStore.getState()
  if (lasso.selectedStrokeIds.length > 0 || lasso.selectedItemIds.length > 0) {
    lasso.clearSelection()
    return
  }
  useCanvasItemsStore.getState().clearSelection()
}

/** Item tap handlers skip selection when another item is selected — canvas dismisses instead. */
export function shouldSkipItemSelectForOutsideDismiss(itemId: string): boolean {
  const { selectedIds } = useCanvasItemsStore.getState()
  return selectedIds.length > 0 && !selectedIds.includes(itemId)
}

/** Clear selection when tapping a non-selected item while something else is selected. */
export function dismissSelectionForOutsideItemTap(itemId: string): boolean {
  if (!shouldSkipItemSelectForOutsideDismiss(itemId)) return false
  if (useCanvasNavigationStore.getState().shouldSuppressBackgroundSelectionClear()) {
    return true
  }
  dismissCanvasSelection()
  return true
}

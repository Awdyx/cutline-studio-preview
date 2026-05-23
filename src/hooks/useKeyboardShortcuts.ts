import { useEffect } from 'react'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { useCanvasLockStore } from '../canvasLock/canvasLockStore'
import { useStrokesStore } from '../drawing/strokesStore'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import { SHORTCUTS_BY_ID } from '../shortcuts/shortcutDefs'
import { modKeyEvent } from '../shortcuts/modKey'
import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

function blurActiveEditable(): boolean {
  const el = document.activeElement
  if (!(el instanceof HTMLElement)) return false
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) {
    el.blur()
    return true
  }
  return false
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

function handleEscape(openPanel: string | null, closePanel: () => void): boolean {
  const ui = useShortcutUiStore.getState()
  if (ui.canvasSearch?.isDropdownOpen()) {
    ui.canvasSearch.closeDropdown()
    return true
  }
  if (ui.canvasSearch?.isInputFocused()) {
    ui.canvasSearch.blurInput()
    return true
  }

  const itemsStore = useCanvasItemsStore.getState()

  if (ui.toolPalette?.isColorPopoverOpen()) {
    ui.toolPalette.closeColorPopover()
    return true
  }

  if (ui.plusFab?.isOpen()) {
    ui.plusFab.close()
    return true
  }

  if (openPanel) {
    closePanel()
    return true
  }

  if (blurActiveEditable()) return true

  if (itemsStore.previewAdjustSpaceId) {
    itemsStore.setPreviewAdjustSpace(null)
    return true
  }

  if (itemsStore.selectedIds.length > 0) {
    itemsStore.clearSelection()
    return true
  }

  return false
}

export function useKeyboardShortcuts(
  openPanel: string | null,
  closePanel: () => void,
) {
  const undo = useStrokesStore((s) => s.undo)
  const redo = useStrokesStore((s) => s.redo)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const editable = isEditableTarget(e.target)
      const mod = modKeyEvent(e)

      if (e.key === 'Escape') {
        if (
          handleEscape(openPanel, closePanel)
        ) {
          e.preventDefault()
        }
        return
      }

      if (editable) {
        if (mod && (e.key === 'z' || e.key === 'Z')) return
        if (mod && (e.key === 'f' || e.key === 'F')) {
          e.preventDefault()
          useShortcutUiStore.getState().canvasSearch?.focus()
          return
        }
        return
      }

      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
          fireToast('redo')
        } else {
          undo()
          fireToast('undo')
        }
        return
      }

      if (mod && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault()
        useCanvasItemsStore.getState().duplicateSelected()
        fireToast('duplicate')
        return
      }

      if (mod && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault()
        useCanvasItemsStore.getState().selectAll()
        fireToast('select-all')
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selectedIds } = useCanvasItemsStore.getState()
        if (selectedIds.length > 0) {
          e.preventDefault()
          useCanvasItemsStore.getState().deleteSelected()
          fireToast('delete')
        }
        return
      }

      if (mod && (e.key === 'l' || e.key === 'L')) {
        const onMain = useCanvasWorkspaceStore.getState().isOnMainCanvas()
        if (!onMain) return
        e.preventDefault()
        const lock = useCanvasLockStore.getState()
        if (lock.isLocked) {
          lock.requestUnlock()
        } else {
          lock.lockCanvas()
        }
        fireToast('toggle-lock')
        return
      }

      if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        const fab = useShortcutUiStore.getState().plusFab
        if (fab?.isOpen()) fab.close()
        else fab?.open()
        return
      }

      if (mod && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        useShortcutUiStore.getState().canvasSearch?.focus()
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, openPanel, closePanel])
}

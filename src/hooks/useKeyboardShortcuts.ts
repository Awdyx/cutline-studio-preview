import { useEffect, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import {
  dismissStudyHubMenuFocus,
  isStudyHubMenuFocusActive,
} from '../canvasItems/studyHubMenuFocus'
import { useCanvasLockStore } from '../canvasLock/canvasLockStore'
import { useToolStore, type ToolMode } from '../drawing/toolStore'
import { useStrokesStore } from '../drawing/strokesStore'
import { useLassoStore } from '../drawing/useLassoStore'
import { isPhoneLayout } from '../platform/layoutProfile'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import { SHORTCUTS_BY_ID } from '../shortcuts/shortcutDefs'
import { modKeyEvent } from '../shortcuts/modKey'
import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'
import { useUiCustomizationStore } from '../uiCustomization/uiCustomizationStore'

/** Map cmd+digit → study hub subject id */
const STUDY_HUB_DIGIT_MAP: Record<string, string> = {
  '1': 'hubs',
  '2': 'cels',
  '3': 'chem',
  '4': 'phsi',
}

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

const DRAW_TOOL_KEYS: Record<string, { mode: ToolMode; shortcutId: string }> = {
  d: { mode: 'pen', shortcutId: 'draw-pen-d' },
  D: { mode: 'pen', shortcutId: 'draw-pen-d' },
  p: { mode: 'pen', shortcutId: 'draw-pen' },
  P: { mode: 'pen', shortcutId: 'draw-pen' },
  h: { mode: 'highlighter', shortcutId: 'draw-highlighter' },
  H: { mode: 'highlighter', shortcutId: 'draw-highlighter' },
  e: { mode: 'erase', shortcutId: 'draw-eraser' },
  E: { mode: 'erase', shortcutId: 'draw-eraser' },
  l: { mode: 'lasso', shortcutId: 'draw-lasso' },
  L: { mode: 'lasso', shortcutId: 'draw-lasso' },
}

function openToolPaletteAndSetMode(mode: ToolMode, shortcutId: string) {
  const ui = useShortcutUiStore.getState()
  const tools = useToolStore.getState()
  const customizing = useUiCustomizationStore.getState().editing

  if (!customizing) {
    if (!ui.toolPaletteOpen) {
      ui.dismissPeerChromeForFab('pen')
      ui.toolPalette?.open()
    }

    if (tools.mode !== mode) {
      tools.setMode(mode)
      if (ui.toolPalette?.isColorPopoverOpen()) {
        ui.toolPalette.closeColorPopover()
      }
    }
  } else if (tools.mode !== mode) {
    // Customize UI tray: switch the embedded draw toolbar only — don't open pen FAB.
    tools.setMode(mode)
  }

  fireToast(shortcutId)
}

function handleDesktopDrawToolShortcut(key: string): boolean {
  if (isPhoneLayout()) return false

  const mapping = DRAW_TOOL_KEYS[key]
  if (!mapping) return false

  openToolPaletteAndSetMode(mapping.mode, mapping.shortcutId)
  return true
}

function handleEscape(
  openPanel: string | null,
  closePanel: () => void,
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
): boolean {
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

  // Close floating settings if open.
  if (ui.closeFloatingSettings?.()) return true

  if (openPanel) {
    closePanel()
    return true
  }

  if (blurActiveEditable()) return true

  if (isStudyHubMenuFocusActive()) {
    dismissStudyHubMenuFocus(transformRef.current)
    return true
  }

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
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
) {
  const undo = useStrokesStore((s) => s.undo)
  const redo = useStrokesStore((s) => s.redo)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const editable = isEditableTarget(e.target)
      const mod = modKeyEvent(e)

      if (e.key === 'Escape') {
        if (
          handleEscape(openPanel, closePanel, transformRef)
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
          if (redo()) fireToast('redo')
        } else {
          // If the lasso just had its selection cleared, restore it instead of
          // consuming a canvas undo step.
          if (!e.shiftKey && useLassoStore.getState().undoClearSelection()) return
          if (undo()) fireToast('undo')
        }
        return
      }

      if (mod && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault()
        useCanvasItemsStore.getState().duplicateSelected()
        fireToast('duplicate')
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

      // ── Create shortcuts ──────────────────────────────────────────────────
      if (mod && !e.shiftKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault()
        useShortcutUiStore.getState().canvasSpawn?.spawnText()
        fireToast('add-text')
        return
      }

      if (mod && !e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        useShortcutUiStore.getState().canvasSpawn?.spawnSticky()
        fireToast('add-sticky')
        return
      }

      if (mod && !e.shiftKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault()
        useShortcutUiStore.getState().canvasSpawn?.openImageAtMousePos()
        fireToast('add-image')
        return
      }

      // ── Panel shortcuts ────────────────────────────────────────────────────
      if (mod && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault()
        useShortcutUiStore.getState().openSettingsNearMouse?.()
        return
      }

      if (mod && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault()
        useShortcutUiStore.getState().openPanel?.('profile')
        return
      }

      if (mod && e.shiftKey && (e.key === 'N' || e.key === 'n')) {
        e.preventDefault()
        // Toggle: if notifications is already open, switch to news.
        const currentPanel = openPanel
        if (currentPanel === 'notifications') {
          useShortcutUiStore.getState().openPanel?.('news')
        } else {
          useShortcutUiStore.getState().openPanel?.('notifications')
        }
        return
      }

      // ── Study hub shortcuts ───────────────────────────────────────────────
      if (mod && !e.shiftKey && STUDY_HUB_DIGIT_MAP[e.key]) {
        e.preventDefault()
        const subjectId = STUDY_HUB_DIGIT_MAP[e.key]
        useShortcutUiStore.getState().canvasSpawn?.spawnStudyHub(subjectId)
        const shortcutId = `study-hub-${e.key}`
        fireToast(shortcutId)
        return
      }

      if (!mod && !e.altKey && handleDesktopDrawToolShortcut(e.key)) {
        e.preventDefault()
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, openPanel, closePanel, transformRef])
}

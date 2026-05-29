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
import { dismissCanvasSelection } from '../canvas/canvasSelectionDismiss'
import { canvasEditingAllowed } from '../canvasEdit/layer'
import { runCanvasFisheyeExit } from '../canvas/canvasBarrelPostProcess'
import { dismissMinimapMode, toggleCanvasMinimap } from '../canvas/canvasMinimapOpen'
import { useCanvasFisheyeStore } from '../canvas/canvasFisheyeStore'
import { useCanvasMinimapStore } from '../canvas/canvasMinimapStore'
import { isPhoneLayout } from '../platform/layoutProfile'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import { SHORTCUTS_BY_ID } from '../shortcuts/shortcutDefs'
import { modKeyEvent } from '../shortcuts/modKey'
import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'
import { useUiCustomizationStore } from '../uiCustomization/uiCustomizationStore'
import {
  effectiveDisplayKeys,
  isShortcutDisabled,
  matchesShortcut,
  useShortcutCustomStore,
  comboMatchesEvent,
} from '../shortcuts/shortcutCustomStore'

/** Map shortcut id → study hub subject id */
const STUDY_HUB_SHORTCUTS: { id: string; subjectId: string }[] = [
  { id: 'study-hub-1', subjectId: 'hubs' },
  { id: 'study-hub-2', subjectId: 'cels' },
  { id: 'study-hub-3', subjectId: 'chem' },
  { id: 'study-hub-4', subjectId: 'phsi' },
]

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
    keys: effectiveDisplayKeys(shortcutId),
    icon: def.icon,
  })
}

const DRAW_SHORTCUT_MODES: { id: string; mode: ToolMode }[] = [
  { id: 'draw-pen', mode: 'pen' },
  { id: 'draw-pen-d', mode: 'pen' },
  { id: 'draw-highlighter', mode: 'highlighter' },
  { id: 'draw-eraser', mode: 'erase' },
  { id: 'draw-lasso', mode: 'lasso' },
]

function openToolPaletteAndSetMode(mode: ToolMode, shortcutId: string) {
  const ui = useShortcutUiStore.getState()
  const tools = useToolStore.getState()
  const customizing = useUiCustomizationStore.getState().editing

  if (!customizing) {
    if (!ui.toolPaletteOpen) {
      ui.dismissPeerChromeForFab('pen')
      const { items, selectedIds } = useCanvasItemsStore.getState()
      if (selectedIds.length === 1) {
      const sel = items.find((i) => i.id === selectedIds[0])
      if (sel?.type === 'text') {
          useCanvasItemsStore.getState().clearSelection({ silent: true })
        }
      }
      ui.toolPalette?.open()
    } else if (tools.mode === mode) {
      ui.toolPalette?.close()
      return
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

function handleDesktopDrawToolShortcut(e: KeyboardEvent): boolean {
  if (isPhoneLayout()) return false

  for (const { id, mode } of DRAW_SHORTCUT_MODES) {
    if (matchesShortcut(e, id)) {
      openToolPaletteAndSetMode(mode, id)
      return true
    }
  }
  return false
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

  if (useCanvasMinimapStore.getState().expandedOpen) {
    dismissMinimapMode(transformRef)
    return true
  }

  if (useCanvasFisheyeStore.getState().engaged) {
    runCanvasFisheyeExit(transformRef.current, null)
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

  const lasso = useLassoStore.getState()
  if (
    lasso.selectedStrokeIds.length > 0 ||
    lasso.selectedItemIds.length > 0 ||
    itemsStore.selectedIds.length > 0
  ) {
    dismissCanvasSelection()
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
        if (handleEscape(openPanel, closePanel, transformRef)) {
          e.preventDefault()
        }
        return
      }

      if (editable) {
        // Let browser handle undo/redo in text fields even if the shortcut is overridden
        if (mod && (e.key === 'z' || e.key === 'Z')) return
        if (matchesShortcut(e, 'find')) {
          e.preventDefault()
          useShortcutUiStore.getState().canvasSearch?.focus()
          return
        }
        return
      }

      // ── Undo / Redo ───────────────────────────────────────────────────────
      if (matchesShortcut(e, 'redo')) {
        e.preventDefault()
        if (redo()) fireToast('redo')
        return
      }

      if (matchesShortcut(e, 'undo')) {
        e.preventDefault()
        if (useLassoStore.getState().undoClearSelection()) return
        if (undo()) fireToast('undo')
        return
      }

      // ── Select all (studio centre) ────────────────────────────────────────
      if (matchesShortcut(e, 'select-all')) {
        if (!canvasEditingAllowed() || useCanvasFisheyeStore.getState().engaged) return
        e.preventDefault()
        if (useLassoStore.getState().selectAllInStudioCentre()) {
          fireToast('select-all')
        }
        return
      }

      // ── Duplicate ─────────────────────────────────────────────────────────
      if (matchesShortcut(e, 'duplicate')) {
        e.preventDefault()
        useCanvasItemsStore.getState().duplicateSelected()
        fireToast('duplicate')
        return
      }

      // ── Delete ────────────────────────────────────────────────────────────
      if (!isShortcutDisabled('delete')) {
        const deleteOverride = useShortcutCustomStore.getState().overrides['delete']
        const isDelete = deleteOverride
          ? comboMatchesEvent(deleteOverride, e)
          : (!modKeyEvent(e) && !e.shiftKey && !e.altKey && (e.key === 'Delete' || e.key === 'Backspace'))
        if (isDelete) {
          const lasso = useLassoStore.getState()
          if (
            lasso.selectedStrokeIds.length > 0 ||
            lasso.selectedItemIds.length > 0
          ) {
            e.preventDefault()
            if (lasso.deleteSelection()) fireToast('delete')
            return
          }

          const { selectedIds } = useCanvasItemsStore.getState()
          if (selectedIds.length > 0) {
            e.preventDefault()
            useCanvasItemsStore.getState().deleteSelected()
            fireToast('delete')
          }
          return
        }
      }

      // ── Canvas lock ───────────────────────────────────────────────────────
      if (matchesShortcut(e, 'toggle-lock')) {
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

      // ── Add to canvas (FAB) ───────────────────────────────────────────────
      if (matchesShortcut(e, 'open-fab')) {
        e.preventDefault()
        const fab = useShortcutUiStore.getState().plusFab
        if (fab?.isOpen()) fab.close()
        else fab?.open()
        return
      }

      // ── Search canvas ─────────────────────────────────────────────────────
      if (matchesShortcut(e, 'find')) {
        e.preventDefault()
        useShortcutUiStore.getState().canvasSearch?.focus()
        return
      }

      // ── Canvas map (fisheye) ───────────────────────────────────────────────
      if (matchesShortcut(e, 'open-canvas-map')) {
        e.preventDefault()
        toggleCanvasMinimap(transformRef)
        return
      }

      // ── Create shortcuts ──────────────────────────────────────────────────
      if (matchesShortcut(e, 'add-text')) {
        e.preventDefault()
        useShortcutUiStore.getState().canvasSpawn?.spawnText()
        fireToast('add-text')
        return
      }

      if (matchesShortcut(e, 'add-sticky')) {
        e.preventDefault()
        useShortcutUiStore.getState().canvasSpawn?.spawnSticky()
        fireToast('add-sticky')
        return
      }

      if (matchesShortcut(e, 'add-image')) {
        e.preventDefault()
        useShortcutUiStore.getState().canvasSpawn?.openImageAtMousePos()
        fireToast('add-image')
        return
      }

      // ── Panel shortcuts ────────────────────────────────────────────────────
      if (matchesShortcut(e, 'open-settings')) {
        e.preventDefault()
        useShortcutUiStore.getState().openSettingsNearMouse?.()
        return
      }

      if (matchesShortcut(e, 'open-profile')) {
        e.preventDefault()
        useShortcutUiStore.getState().openPanel?.('profile')
        return
      }

      if (matchesShortcut(e, 'open-notifications')) {
        e.preventDefault()
        const currentPanel = openPanel
        if (currentPanel === 'notifications') {
          useShortcutUiStore.getState().openPanel?.('news')
        } else {
          useShortcutUiStore.getState().openPanel?.('notifications')
        }
        return
      }

      // ── Study hub shortcuts ───────────────────────────────────────────────
      for (const { id, subjectId } of STUDY_HUB_SHORTCUTS) {
        if (matchesShortcut(e, id)) {
          e.preventDefault()
          useShortcutUiStore.getState().canvasSpawn?.spawnStudyHub(subjectId)
          fireToast(id)
          return
        }
      }

      // ── Draw tool shortcuts ───────────────────────────────────────────────
      if (handleDesktopDrawToolShortcut(e)) {
        e.preventDefault()
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, openPanel, closePanel, transformRef])
}

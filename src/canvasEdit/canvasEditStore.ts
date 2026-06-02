import { create } from 'zustand'
import { cancelCanvasItemDrag } from '../canvasItems/canvasItemDrag'
import { cancelCanvasItemResize } from '../canvasItems/useCanvasItemResize'
import { isPhoneLayout } from '../platform/layoutProfile'
import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'
import { useStrokesStore } from '../drawing/strokesStore'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import {
  loadCanvasEditFromStorage,
  saveCanvasEditToStorage,
  type PersistedCanvasEditSettings,
} from './canvasEditPersistence'

type CanvasEditState = PersistedCanvasEditSettings & {
  hydrated: boolean
  hydrate: () => void
  setEnabled: (enabled: boolean) => void
  syncLayoutChrome: () => void
}

let persistEnabled = false

function persist(settings: PersistedCanvasEditSettings) {
  if (persistEnabled) saveCanvasEditToStorage(settings)
}

function syncDocumentAttribute(enabled: boolean) {
  if (typeof document === 'undefined') return
  if (isPhoneLayout() && !enabled) {
    document.documentElement.setAttribute('data-canvas-edit-disabled', '')
  } else {
    document.documentElement.removeAttribute('data-canvas-edit-disabled')
  }
}

function applyDisabledSideEffects() {
  cancelCanvasItemDrag()
  cancelCanvasItemResize()

  const ui = useShortcutUiStore.getState()
  ui.plusFab?.close({ silent: true })
  ui.toolPalette?.close({ silent: true })

  const strokes = useStrokesStore.getState()
  strokes.cancelActiveStroke()
  strokes.cancelEraseSession()
  useCanvasItemsStore.getState().cancelActiveStickyStroke()
}

export const useCanvasEditStore = create<CanvasEditState>((set, get) => ({
  enabled: isPhoneLayout(),
  hydrated: false,

  hydrate: () => {
    const loaded = loadCanvasEditFromStorage()
    set({ ...loaded, hydrated: true })
    persistEnabled = true
    syncDocumentAttribute(loaded.enabled)
  },

  setEnabled: (enabled) => {
    const wasEnabled = get().enabled
    set({ enabled })
    persist(get())
    syncDocumentAttribute(enabled)
    if (wasEnabled && !enabled && isPhoneLayout()) {
      applyDisabledSideEffects()
    }
  },

  syncLayoutChrome: () => {
    syncDocumentAttribute(get().enabled)
  },
}))

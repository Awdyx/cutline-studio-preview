import { create } from 'zustand'
import { ArrowDownToLine, ArrowUpToLine } from 'lucide-react'
import { pushUndoSnapshot } from '../canvasHistory/canvasHistory'
import { playSound } from '../sound/playSound'
import {
  effectiveCanvasLocked,
  itemLayer,
  isItemFrozen,
  newItemLayer,
} from '../canvasLock/layer'
import { useCanvasLockStore } from '../canvasLock/canvasLockStore'
import { ERASE_HIT_RADIUS, hitTestStroke } from '../drawing/eraseUtils'
import { generateStrokeId } from '../drawing/strokeId'
import { strokeToSvgPath } from '../drawing/strokePath'
import type { DrawTool, Stroke, StrokePoint } from '../drawing/types'
import { notifyWorkspacePersist, useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'
import { duplicateMediaForItem } from '../media/workspaceMediaMigration'
import { scheduleMediaBlobGc } from '../media/mediaBlobGc'
import { generateItemId } from './itemId'
import {
  nextZIndexForLayer,
  zIndexForBringToFront,
  zIndexForRaiseInPlane,
  zIndexForSendToBack,
} from './canvasZOrder'
import {
  SPACE_HEIGHT,
  SPACE_WIDTH,
  MAX_SPACE_WIDGETS,
  STICKY_HEIGHT,
  STICKY_WIDTH,
  TEXT_HEIGHT,
  TEXT_WIDTH,
  type CanvasItem,
  type ImageCanvasItem,
  type SpaceCanvasItem,
  type StickyCanvasItem,
  type TextCanvasItem,
  type VideoCanvasItem,
} from './types'
import { DEFAULT_SPACE_NAME } from '../spaces/types'
import {
  DEFAULT_SPACE_NAME_ALIGNMENT,
  DEFAULT_TEXT_ALIGNMENT,
  type ItemTextAlignment,
  resolveItemTextAlignment,
} from './textAlignment'
import { isStoredTextEmpty } from './textEditorContent'

type StrokeConfig = {
  color: string
  size: number
  tool: DrawTool
}

const RESTORE_SIZING_MS = 320

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

let restoreSizingFrameId: number | null = null
let restoreSizingItemId: string | null = null

type ZOrderPulse = {
  id: string
  dir: 'front' | 'back'
  nonce: number
}

function emitZOrderFeedback(
  get: () => CanvasItemsState,
  set: (partial: Partial<CanvasItemsState>) => void,
  id: string,
  dir: 'front' | 'back',
): void {
  playSound(dir === 'front' ? 'zOrderFront' : 'zOrderBack')
  useShortcutUiStore.getState().showActionToast({
    shortcutId: dir === 'front' ? 'z-order-front' : 'z-order-back',
    label: dir === 'front' ? 'Brought to front' : 'Sent to back',
    keys: [],
    icon: dir === 'front' ? ArrowUpToLine : ArrowDownToLine,
  })
  set({
    zOrderPulse: {
      id,
      dir,
      nonce: (get().zOrderPulse?.nonce ?? 0) + 1,
    },
  })
}

type CanvasItemsState = {
  items: CanvasItem[]
  selectedIds: string[]
  previewAdjustSpaceId: string | null
  restoreSizingAnimatingId: string | null
  zOrderPulse: ZOrderPulse | null
  /** Set when user spawns text; consumed on mount to focus editor once. */
  pendingEditorFocusId: string | null
  activeStickyStroke: { stickyId: string; stroke: Stroke } | null
  hydrate: () => void
  takePendingEditorFocus: (id: string) => boolean
  setSelectedIds: (ids: string[]) => void
  selectItem: (id: string, additive?: boolean, options?: { allowFrozen?: boolean }) => void
  clearSelection: (opts?: { silent?: boolean }) => void
  selectAll: () => void
  deleteSelected: () => void
  duplicateSelected: () => void
  addSticky: (x: number, y: number) => string
  addText: (x: number, y: number) => string
  addImage: (x: number, y: number, mediaId: string, width: number, height: number) => string
  addVideo: (x: number, y: number, mediaId: string, width: number, height: number) => string
  addSpace: (x: number, y: number) => string
  beginItemDrag: (id: string) => void
  beginItemResize: (id: string) => void
  updateItemPosition: (id: string, x: number, y: number) => void
  updateItemSize: (id: string, width: number, height: number) => void
  restoreImportSizing: (id: string) => void
  bringToFront: (id: string) => void
  sendToBack: (id: string) => void
  raiseInPlane: (id: string) => void
  deleteItem: (id: string) => void
  commitStickyTextEdit: (id: string, text: string) => void
  updateStickyText: (id: string, text: string) => void
  commitTextItemEdit: (id: string, text: string) => void
  updateTextItemText: (id: string, text: string) => void
  setItemTextAlignment: (id: string, alignment: ItemTextAlignment) => void
  setPreviewAdjustSpace: (id: string | null) => void
  updateSpacePreviewPan: (id: string, pan: SpacePreviewPan) => void
  getStickyById: (id: string) => StickyCanvasItem | undefined
  startStickyStroke: (stickyId: string, point: StrokePoint, config: StrokeConfig) => void
  addStickyStrokePoint: (point: StrokePoint) => void
  endStickyStroke: () => void
  cancelActiveStickyStroke: () => void
  applyStickyStrokeErase: (canvasPos: { x: number; y: number }) => void
}

let persistEnabled = false

function createStroke(point: StrokePoint, config: StrokeConfig): Stroke {
  return {
    id: generateStrokeId(),
    points: [point],
    color: config.color,
    size: config.size,
    tool: config.tool,
  }
}

function persistItems(opts?: { immediate?: boolean }) {
  if (!persistEnabled) return
  if (opts?.immediate) {
    useCanvasWorkspaceStore.getState().flushPersistWorkspace()
    return
  }
  notifyWorkspacePersist()
}

function findItem(items: CanvasItem[], id: string): CanvasItem | undefined {
  return items.find((item) => item.id === id)
}

export function countSpaceWidgets(items: CanvasItem[]): number {
  return items.filter((item) => item.type === 'space').length
}

export function canAddSpaceWidget(items: CanvasItem[]): boolean {
  return countSpaceWidgets(items) < MAX_SPACE_WIDGETS
}

function itemIsMutable(item: CanvasItem | undefined): item is CanvasItem {
  if (!item) return false
  return !isItemFrozen(item, useCanvasLockStore.getState().isLocked)
}

function flushActiveTextEditor() {
  const el = document.activeElement
  if (el instanceof HTMLElement && el.isContentEditable) {
    el.blur()
  }
}

function dismissEmptyTextItemsOnDeselect(
  get: () => CanvasItemsState,
  set: (partial: Partial<CanvasItemsState> | ((state: CanvasItemsState) => Partial<CanvasItemsState>)) => void,
  deselectedIds: readonly string[],
) {
  if (deselectedIds.length === 0) return

  const state = get()
  const remove = new Set(
    deselectedIds.filter((id) => {
      const item = findItem(state.items, id)
      return item?.type === 'text' && isStoredTextEmpty(item.text)
    }),
  )
  if (remove.size === 0) return

  set((current) => ({
    items: current.items.filter((item) => !remove.has(item.id)),
    selectedIds: current.selectedIds.filter((id) => !remove.has(id)),
    pendingEditorFocusId:
      current.pendingEditorFocusId && remove.has(current.pendingEditorFocusId)
        ? null
        : current.pendingEditorFocusId,
  }))
  persistItems({ immediate: true })
}

function applySelectionChange(
  get: () => CanvasItemsState,
  set: (partial: Partial<CanvasItemsState> | ((state: CanvasItemsState) => Partial<CanvasItemsState>)) => void,
  nextSelected: string[],
) {
  const prevSelected = get().selectedIds
  set({ selectedIds: nextSelected })
  dismissEmptyTextItemsOnDeselect(
    get,
    set,
    prevSelected.filter((id) => !nextSelected.includes(id)),
  )
}

function cloneItem(item: CanvasItem, offset: number, forcedId?: string): CanvasItem {
  const id = forcedId ?? generateItemId()
  const base = {
    ...item,
    id,
    x: item.x + offset,
    y: item.y + offset,
    zIndex: item.zIndex + 1,
  }
  if (item.type === 'space') {
    useCanvasWorkspaceStore.getState().addSpaceData(id, item.name, { persist: false })
  }
  if (item.type === 'image' || item.type === 'video') {
    return { ...base, mediaId: id } as CanvasItem
  }
  return base
}

export const useCanvasItemsStore = create<CanvasItemsState>((set, get) => ({
  items: [],
  selectedIds: [],
  previewAdjustSpaceId: null,
  restoreSizingAnimatingId: null,
  zOrderPulse: null,
  pendingEditorFocusId: null,
  activeStickyStroke: null,

  hydrate: () => {
    persistEnabled = true
  },

  takePendingEditorFocus: (id) => {
    if (get().pendingEditorFocusId !== id) return false
    set({ pendingEditorFocusId: null })
    return true
  },

  setSelectedIds: (ids) => set({ selectedIds: ids }),

  selectItem: (id, additive = false, options) => {
    const item = findItem(get().items, id)
    if (!item) return
    if (!options?.allowFrozen && !itemIsMutable(item)) return

    useShortcutUiStore.getState().dismissChromeForCanvasInteraction()

    const prevSelected = get().selectedIds
    let shouldPlay = false
    set((state) => {
      if (additive) {
        const has = state.selectedIds.includes(id)
        if (has) {
          return { selectedIds: state.selectedIds.filter((x) => x !== id) }
        }
        shouldPlay = true
        return { selectedIds: [...state.selectedIds, id] }
      }
      if (state.selectedIds.length === 1 && state.selectedIds[0] === id) {
        return state
      }
      shouldPlay = true
      return { selectedIds: [id] }
    })

    const nextSelected = get().selectedIds
    flushActiveTextEditor()
    dismissEmptyTextItemsOnDeselect(
      get,
      set,
      prevSelected.filter((entry) => !nextSelected.includes(entry)),
    )

    const adjustId = get().previewAdjustSpaceId
    const soleSelected = nextSelected.length === 1 ? nextSelected[0] : null
    if (adjustId && soleSelected !== adjustId) {
      set({ previewAdjustSpaceId: null })
    }

    if (shouldPlay) playSound('itemSelect')
  },

  clearSelection: (opts?: { silent?: boolean }) => {
    const prevSelected = get().selectedIds
    if (prevSelected.length === 0) return
    if (!opts?.silent) {
      useShortcutUiStore.getState().dismissChromeForCanvasInteraction()
    }
    set({
      selectedIds: [],
      previewAdjustSpaceId: null,
    })
    flushActiveTextEditor()
    dismissEmptyTextItemsOnDeselect(get, set, prevSelected)
    if (!opts?.silent) playSound('itemDeselect')
  },

  selectAll: () => {
    const ids = get()
      .items.filter((item) => itemIsMutable(item))
      .map((item) => item.id)
    applySelectionChange(get, set, ids)
  },

  deleteSelected: () => {
    const { selectedIds, items } = get()
    if (selectedIds.length === 0) return
    const toDelete = selectedIds.filter((id) =>
      itemIsMutable(findItem(items, id)),
    )
    if (toDelete.length === 0) return
    pushUndoSnapshot()
    const prevSelected = selectedIds
    set((state) => {
      const remove = new Set(toDelete)
      const nextItems = state.items.filter((item) => !remove.has(item.id))
      return {
        items: nextItems,
        selectedIds: [],
        previewAdjustSpaceId: null,
        activeStickyStroke:
          state.activeStickyStroke &&
          remove.has(state.activeStickyStroke.stickyId)
            ? null
            : state.activeStickyStroke,
      }
    })
    dismissEmptyTextItemsOnDeselect(get, set, prevSelected)
    scheduleMediaBlobGc()
    persistItems({ immediate: true })
  },

  duplicateSelected: () => {
    const { selectedIds, items } = get()
    if (selectedIds.length === 0) return
    const sources = selectedIds
      .map((id) => findItem(items, id))
      .filter((item): item is CanvasItem => itemIsMutable(item))
    if (sources.length === 0) return
    pushUndoSnapshot()
    const offset = 24
    void (async () => {
      const clones: CanvasItem[] = []
      let spaceCount = countSpaceWidgets(items)
      for (const source of sources) {
        if (source.type === 'space') {
          if (spaceCount >= MAX_SPACE_WIDGETS) continue
          spaceCount++
        }
        const id = generateItemId()
        if (source.type === 'image' || source.type === 'video') {
          const copied = await duplicateMediaForItem(source.mediaId, id)
          if (!copied) continue
        }
        clones.push(cloneItem(source, offset, id))
      }
      if (clones.length === 0) return
      const newIds = clones.map((c) => c.id)
      const prevSelected = get().selectedIds
      set((state) => ({
        items: [...state.items, ...clones],
        selectedIds: newIds,
      }))
      dismissEmptyTextItemsOnDeselect(
        get,
        set,
        prevSelected.filter((id) => !newIds.includes(id)),
      )
      persistItems({ immediate: true })
    })()
  },

  addSticky: (x, y) => {
    pushUndoSnapshot()
    const id = generateItemId()
    const items = get().items
    const prevSelected = get().selectedIds
    const layer = newItemLayer(useCanvasLockStore.getState().isLocked)
    const sticky: StickyCanvasItem = {
      id,
      type: 'sticky',
      x: x - STICKY_WIDTH / 2,
      y: y - STICKY_HEIGHT / 2,
      zIndex: nextZIndexForLayer(items, layer),
      width: STICKY_WIDTH,
      height: STICKY_HEIGHT,
      text: '',
      strokes: [],
      textAlign: DEFAULT_TEXT_ALIGNMENT,
      ...(layer === 'annotation' ? { layer } : {}),
    }
    const next = [...items, sticky]
    set({ items: next, selectedIds: [id] })
    dismissEmptyTextItemsOnDeselect(get, set, prevSelected)
    persistItems({ immediate: true })
    playSound('spawn')
    return id
  },

  addText: (x, y) => {
    const prevSelected = get().selectedIds
    pushUndoSnapshot()
    const id = generateItemId()
    const items = get().items
    const layer = newItemLayer(useCanvasLockStore.getState().isLocked)
    const textItem: TextCanvasItem = {
      id,
      type: 'text',
      x: x - TEXT_WIDTH / 2,
      y: y - TEXT_HEIGHT / 2,
      zIndex: nextZIndexForLayer(items, layer),
      width: TEXT_WIDTH,
      height: TEXT_HEIGHT,
      text: '',
      textAlign: DEFAULT_TEXT_ALIGNMENT,
      ...(layer === 'annotation' ? { layer } : {}),
    }
    const next = [...items, textItem]
    set({
      items: next,
      pendingEditorFocusId: id,
      selectedIds: [id],
    })
    dismissEmptyTextItemsOnDeselect(get, set, prevSelected)
    persistItems({ immediate: true })
    playSound('spawn')
    return id
  },

  addImage: (x, y, mediaId, width, height) => {
    pushUndoSnapshot()
    const items = get().items
    const layer = newItemLayer(useCanvasLockStore.getState().isLocked)
    const image: ImageCanvasItem = {
      id: mediaId,
      type: 'image',
      x: x - width / 2,
      y: y - height / 2,
      zIndex: nextZIndexForLayer(items, layer),
      width,
      height,
      importWidth: width,
      importHeight: height,
      mediaId,
      ...(layer === 'annotation' ? { layer } : {}),
    }
    const next = [...items, image]
    set({ items: next })
    persistItems({ immediate: true })
    playSound('spawn')
    return mediaId
  },

  addVideo: (x, y, mediaId, width, height) => {
    pushUndoSnapshot()
    const items = get().items
    const layer = newItemLayer(useCanvasLockStore.getState().isLocked)
    const video: VideoCanvasItem = {
      id: mediaId,
      type: 'video',
      x: x - width / 2,
      y: y - height / 2,
      zIndex: nextZIndexForLayer(items, layer),
      width,
      height,
      importWidth: width,
      importHeight: height,
      mediaId,
      ...(layer === 'annotation' ? { layer } : {}),
    }
    const next = [...items, video]
    set({ items: next })
    persistItems({ immediate: true })
    playSound('spawn')
    return mediaId
  },

  addSpace: (x, y) => {
    if (!useCanvasWorkspaceStore.getState().isOnMainCanvas()) return ''
    const items = get().items
    if (!canAddSpaceWidget(items)) return ''
    pushUndoSnapshot()
    const id = generateItemId()
    const layer = newItemLayer(useCanvasLockStore.getState().isLocked)
    const space: SpaceCanvasItem = {
      id,
      type: 'space',
      x: x - SPACE_WIDTH / 2,
      y: y - SPACE_HEIGHT / 2,
      zIndex: nextZIndexForLayer(items, layer),
      width: SPACE_WIDTH,
      height: SPACE_HEIGHT,
      name: DEFAULT_SPACE_NAME,
      snapshotId: null,
      textAlign: DEFAULT_SPACE_NAME_ALIGNMENT,
      ...(layer === 'annotation' ? { layer } : {}),
    }
    const next = [...items, space]
    set({ items: next })
    useCanvasWorkspaceStore
      .getState()
      .addSpaceData(id, DEFAULT_SPACE_NAME, { persist: false })
    persistItems({ immediate: true })
    playSound('spawn')
    return id
  },

  beginItemDrag: (id: string) => {
    if (!itemIsMutable(findItem(get().items, id))) return
    pushUndoSnapshot()
  },

  beginItemResize: (id: string) => {
    if (!itemIsMutable(findItem(get().items, id))) return
    pushUndoSnapshot()
  },

  updateItemPosition: (id, x, y) => {
    if (!itemIsMutable(findItem(get().items, id))) return
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, x, y } : item,
      ),
    }))
    persistItems()
  },

  updateItemSize: (id, width, height) => {
    if (!itemIsMutable(findItem(get().items, id))) return
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, width, height } : item,
      ),
    }))
    persistItems()
  },

  restoreImportSizing: (id) => {
    const item = findItem(get().items, id)
    if (!item || (item.type !== 'image' && item.type !== 'video')) return
    if (!itemIsMutable(item)) return
    if (item.importWidth == null || item.importHeight == null) return
    if (
      item.width === item.importWidth &&
      item.height === item.importHeight
    ) {
      return
    }

    if (restoreSizingFrameId != null) {
      cancelAnimationFrame(restoreSizingFrameId)
      restoreSizingFrameId = null
    }

    pushUndoSnapshot()

    const from = {
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
    }
    const centerX = from.x + from.width / 2
    const centerY = from.y + from.height / 2
    const to = {
      x: centerX - item.importWidth / 2,
      y: centerY - item.importHeight / 2,
      width: item.importWidth,
      height: item.importHeight,
    }

    restoreSizingItemId = id
    set({ restoreSizingAnimatingId: id })

    const started = performance.now()

    const tick = (now: number) => {
      if (restoreSizingItemId !== id) return

      const t = Math.min(1, (now - started) / RESTORE_SIZING_MS)
      const eased = easeOutCubic(t)
      const x = from.x + (to.x - from.x) * eased
      const y = from.y + (to.y - from.y) * eased
      const width = from.width + (to.width - from.width) * eased
      const height = from.height + (to.height - from.height) * eased

      set((state) => ({
        restoreSizingAnimatingId: t < 1 ? id : null,
        items: state.items.map((entry) =>
          entry.id === id ? { ...entry, x, y, width, height } : entry,
        ),
      }))

      if (t < 1) {
        restoreSizingFrameId = requestAnimationFrame(tick)
      } else {
        restoreSizingFrameId = null
        restoreSizingItemId = null
        persistItems({ immediate: true })
      }
    }

    restoreSizingFrameId = requestAnimationFrame(tick)
  },

  bringToFront: (id) => {
    const item = findItem(get().items, id)
    if (!itemIsMutable(item)) return
    const zIndex = zIndexForBringToFront(get().items, id)
    if (item.zIndex === zIndex) {
      emitZOrderFeedback(get, set, id, 'front')
      return
    }
    pushUndoSnapshot()
    set((state) => ({
      items: state.items.map((entry) =>
        entry.id === id ? { ...entry, zIndex } : entry,
      ),
    }))
    emitZOrderFeedback(get, set, id, 'front')
    persistItems({ immediate: true })
  },

  sendToBack: (id) => {
    const item = findItem(get().items, id)
    if (!itemIsMutable(item)) return
    const zIndex = zIndexForSendToBack(get().items, id)
    if (item.zIndex === zIndex) {
      emitZOrderFeedback(get, set, id, 'back')
      return
    }
    pushUndoSnapshot()
    set((state) => ({
      items: state.items.map((entry) =>
        entry.id === id ? { ...entry, zIndex } : entry,
      ),
    }))
    emitZOrderFeedback(get, set, id, 'back')
    persistItems({ immediate: true })
  },

  raiseInPlane: (id) => {
    if (!itemIsMutable(findItem(get().items, id))) return
    set((state) => {
      const zIndex = zIndexForRaiseInPlane(state.items, id)
      return {
        items: state.items.map((item) =>
          item.id === id ? { ...item, zIndex } : item,
        ),
      }
    })
    persistItems()
  },

  deleteItem: (id) => {
    if (!itemIsMutable(findItem(get().items, id))) return
    const target = findItem(get().items, id)
    pushUndoSnapshot()
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
      activeStickyStroke:
        state.activeStickyStroke?.stickyId === id ? null : state.activeStickyStroke,
      selectedIds: state.selectedIds.filter((sid) => sid !== id),
      previewAdjustSpaceId:
        state.previewAdjustSpaceId === id ? null : state.previewAdjustSpaceId,
    }))
    persistItems({ immediate: true })
    if (target && (target.type === 'image' || target.type === 'video')) {
      scheduleMediaBlobGc()
    }
  },

  commitStickyTextEdit: (id, text) => {
    const item = get().items.find((i) => i.id === id)
    if (!itemIsMutable(item) || item?.type !== 'sticky' || item.text === text) return
    pushUndoSnapshot()
    get().updateStickyText(id, text)
  },

  updateStickyText: (id, text) => {
    if (!itemIsMutable(findItem(get().items, id))) return
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id && item.type === 'sticky' ? { ...item, text } : item,
      ),
    }))
    persistItems()
  },

  commitTextItemEdit: (id, text) => {
    const item = get().items.find((i) => i.id === id)
    if (!itemIsMutable(item) || item?.type !== 'text' || item.text === text) return
    pushUndoSnapshot()
    get().updateTextItemText(id, text)
  },

  updateTextItemText: (id, text) => {
    if (!itemIsMutable(findItem(get().items, id))) return
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id && item.type === 'text' ? { ...item, text } : item,
      ),
    }))
    persistItems()
  },

  setItemTextAlignment: (id, alignment) => {
    const item = get().items.find((i) => i.id === id)
    if (!itemIsMutable(item)) return
    if (item?.type !== 'sticky' && item?.type !== 'text' && item?.type !== 'space') return
    const current = resolveItemTextAlignment(item)
    if (
      current.horizontal === alignment.horizontal &&
      current.vertical === alignment.vertical
    ) {
      return
    }
    pushUndoSnapshot()
    set((state) => ({
      items: state.items.map((entry) =>
        entry.id === id &&
        (entry.type === 'sticky' || entry.type === 'text' || entry.type === 'space')
          ? { ...entry, textAlign: alignment }
          : entry,
      ),
    }))
    persistItems({ immediate: true })
  },

  setPreviewAdjustSpace: (id) => {
    const current = get().previewAdjustSpaceId
    if (current === id) return
    if (id != null) {
      const item = findItem(get().items, id)
      if (!itemIsMutable(item) || item?.type !== 'space') return
    }
    set({ previewAdjustSpaceId: id })
  },

  updateSpacePreviewPan: (id, pan) => {
    const item = findItem(get().items, id)
    if (!itemIsMutable(item) || item?.type !== 'space') return
    set((state) => ({
      items: state.items.map((entry) =>
        entry.id === id && entry.type === 'space'
          ? { ...entry, previewPan: pan }
          : entry,
      ),
    }))
    persistItems()
  },

  getStickyById: (id) => {
    const item = get().items.find((i) => i.id === id)
    return item?.type === 'sticky' ? item : undefined
  },

  startStickyStroke: (stickyId, point, config) => {
    set({ activeStickyStroke: { stickyId, stroke: createStroke(point, config) } })
  },

  addStickyStrokePoint: (point) => {
    const { activeStickyStroke } = get()
    if (!activeStickyStroke) return
    set({
      activeStickyStroke: {
        ...activeStickyStroke,
        stroke: {
          ...activeStickyStroke.stroke,
          points: [...activeStickyStroke.stroke.points, point],
        },
      },
    })
  },

  cancelActiveStickyStroke: () => {
    set({ activeStickyStroke: null })
  },

  applyStickyStrokeErase: (canvasPos) => {
    if (!useCanvasLockStore.getState().isLocked) return

    let changed = false
    set((state) => {
      const items = state.items.map((item) => {
        if (item.type !== 'sticky') return item

        const localX = canvasPos.x - item.x
        const localY = canvasPos.y - item.y

        if (item.layer === 'annotation') {
          const next = item.strokes.filter(
            (stroke) =>
              !hitTestStroke(stroke, localX, localY, ERASE_HIT_RADIUS),
          )
          if (next.length === item.strokes.length) return item
          changed = true
          return { ...item, strokes: next }
        }

        const ann = item.annotationStrokes ?? []
        if (ann.length === 0) return item
        const next = ann.filter(
          (stroke) => !hitTestStroke(stroke, localX, localY, ERASE_HIT_RADIUS),
        )
        if (next.length === ann.length) return item
        changed = true
        return { ...item, annotationStrokes: next }
      })
      if (!changed) return state
      return { items }
    })
    if (changed) persistItems()
  },

  endStickyStroke: () => {
    const active = get().activeStickyStroke
    if (!active) return

    let points = [...active.stroke.points]
    while (points.length > 2 && points[points.length - 1].pressure < 0.15) {
      points.pop()
    }

    if (points.length < 3) {
      set({ activeStickyStroke: null })
      return
    }

    pushUndoSnapshot()

    const trimmed: Stroke = { ...active.stroke, points }
    const path = strokeToSvgPath(trimmed, true)
    const completed = { ...trimmed, path }

    const isLocked = effectiveCanvasLocked(
      useCanvasLockStore.getState().isLocked,
    )

    set((state) => ({
      items: state.items.map((item) => {
        if (item.id !== active.stickyId || item.type !== 'sticky') return item
        const onCommittedLayer = isLocked && itemLayer(item) === 'committed'
        if (onCommittedLayer) {
          const annotationStrokes = [...(item.annotationStrokes ?? []), completed]
          return { ...item, annotationStrokes }
        }
        return { ...item, strokes: [...item.strokes, completed] }
      }),
      activeStickyStroke: null,
    }))
    persistItems({ immediate: true })
  },
}))

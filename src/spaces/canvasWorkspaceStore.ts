import { create } from 'zustand'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { clearHistory } from '../canvasHistory/canvasHistory'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import type { CanvasItem } from '../canvasItems/types'
import { useStrokesStore } from '../drawing/strokesStore'
import type { Stroke } from '../drawing/types'
import {
  loadWorkspaceFromStorage,
  flushScheduledWorkspaceSave,
  scheduleSaveWorkspace,
  saveWorkspaceToStorage,
  WORKSPACE_STORAGE_VERSION,
  type LoadedWorkspace,
} from './workspacePersistence'
import {
  migrateWorkspaceMediaToIdb,
  workspaceNeedsMediaMigration,
} from '../media/workspaceMediaMigration'
import { backfillCanvasItemsImportDimensions } from '../media/mediaImportDimensions'
import { recoverMissingWorkspaceMedia } from '../media/workspaceMediaRecovery'
import {
  resetLegacyMediaSrcIndex,
  rehydrateMissingBlobsForItems,
} from '../media/tryRecoverMediaBlob'
import { putSnapshotFromDataUrl } from '../media/mediaBlobStore'
import { normalizeLoadedWorkspace } from './normalizeWorkspace'
import {
  applyCameraToRef,
  isCameraPlausible,
  isUninitializedMainCamera,
  readCameraFromRef,
  resetToCoverFit,
} from '../canvas/canvasCamera'
import { captureCanvasSnapshot } from './spaceSnapshot'
import { spaceCardClientRect } from './spaceCardRect'
import type { SpaceCanvasItem } from '../canvasItems/types'
import {
  DEFAULT_SPACE_CAMERA,
  DEFAULT_SPACE_NAME,
  clampSpaceName,
  type ActiveCanvasId,
  type SpaceCamera,
  type SpaceCanvasData,
  type SpaceTransitionState,
} from './types'

type CanvasWorkspaceState = {
  activeCanvasId: ActiveCanvasId
  spaces: Record<string, SpaceCanvasData>
  transition: SpaceTransitionState
  hydrate: () => Promise<void>
  isInsideSpace: () => boolean
  isOnMainCanvas: () => boolean
  getSpaceName: (spaceId: string) => string
  syncFromActiveStores: () => void
  flushActiveToSlot: () => void
  loadActiveFromSlot: (canvasId: ActiveCanvasId) => void
  persistWorkspace: () => void
  /** Sync active canvas into memory and write workspace to localStorage immediately. */
  flushPersistWorkspace: () => void
  addSpaceData: (spaceId: string, name?: string, opts?: { persist?: boolean }) => void
  updateSpaceName: (spaceId: string, name: string) => void
  updateSpaceSnapshot: (spaceId: string, snapshotDataUrl: string | null) => Promise<void>
  saveCameraForActive: (camera: SpaceCamera) => void
  getCameraForSpace: (spaceId: string) => SpaceCamera
  beginEnterSpace: (spaceId: string, cardRect: DOMRect) => void
  completeEnterSpace: (transformRef: ReactZoomPanPinchContentRef | null) => void
  beginExitSpace: (transformRef: ReactZoomPanPinchContentRef | null) => void
  captureExitSnapshot: (
    transformRef: ReactZoomPanPinchContentRef | null,
    canvasEl: HTMLElement | null,
  ) => Promise<void>
  completeExitSpace: (transformRef: ReactZoomPanPinchContentRef | null) => void
  setTransitionIdle: () => void
  syncMainCamera: (transformRef: ReactZoomPanPinchContentRef | null) => void
  applyCameraForActiveCanvas: (
    transformRef: ReactZoomPanPinchContentRef | null,
  ) => void
}

let persistEnabled = false
let workspaceHydrated = false
let mainItemsCache: CanvasItem[] = []
let mainStrokesCache: Stroke[] = []
let mainAnnotationStrokesCache: Stroke[] = []
let mainCameraCache: SpaceCamera | null = null

function patchMainSpaceItem(
  spaceId: string,
  patch: Partial<Pick<SpaceCanvasItem, 'name' | 'snapshotId'>>,
): void {
  mainItemsCache = mainItemsCache.map((item) =>
    item.id === spaceId && item.type === 'space' ? { ...item, ...patch } : item,
  )
}

function workspaceSnapshot(
  state: Pick<
    CanvasWorkspaceState,
    'activeCanvasId' | 'spaces'
  >,
): LoadedWorkspace {
  return {
    mainItems: mainItemsCache,
    mainStrokes: mainStrokesCache,
    mainAnnotationStrokes: mainAnnotationStrokesCache,
    spaces: state.spaces,
    activeCanvasId: state.activeCanvasId,
    mainCamera: mainCameraCache,
    storageVersion: WORKSPACE_STORAGE_VERSION,
  }
}

function snapshotForPersist(): LoadedWorkspace {
  const ws = useCanvasWorkspaceStore.getState()
  ws.flushActiveToSlot()
  return workspaceSnapshot(useCanvasWorkspaceStore.getState())
}

export function isWorkspaceHydrated(): boolean {
  return workspaceHydrated
}

export const useCanvasWorkspaceStore = create<CanvasWorkspaceState>((set, get) => ({
  activeCanvasId: 'main',
  spaces: {},
  transition: { phase: 'idle', spaceId: null, cardRect: null },

  hydrate: async () => {
    workspaceHydrated = false
    resetLegacyMediaSrcIndex()
    let loaded = loadWorkspaceFromStorage()
    if (
      workspaceNeedsMediaMigration(loaded, loaded.storageVersion) ||
      loaded.migratedFromLegacy
    ) {
      const migrated = await migrateWorkspaceMediaToIdb(loaded)
      if (migrated) {
        loaded = { ...migrated, storageVersion: WORKSPACE_STORAGE_VERSION }
        saveWorkspaceToStorage(loaded)
      } else {
        console.warn(
          '[spaces] media migration to IndexedDB failed — keeping inline localStorage data',
        )
      }
    }

    const recovered = await recoverMissingWorkspaceMedia(loaded)
    loaded = recovered.workspace
    if (recovered.recoveredCount > 0) {
      saveWorkspaceToStorage(loaded)
    }

    const normalized = normalizeLoadedWorkspace(loaded)

    const mainItems = await backfillCanvasItemsImportDimensions(normalized.mainItems)
    const spaces: typeof normalized.spaces = {}
    for (const [spaceId, space] of Object.entries(normalized.spaces)) {
      spaces[spaceId] = {
        ...space,
        items: await backfillCanvasItemsImportDimensions(space.items),
      }
    }

    const importDimsChanged =
      JSON.stringify(mainItems) !== JSON.stringify(normalized.mainItems) ||
      JSON.stringify(spaces) !== JSON.stringify(normalized.spaces)

    mainItemsCache = mainItems
    mainStrokesCache = normalized.mainStrokes
    mainAnnotationStrokesCache = normalized.mainAnnotationStrokes
    mainCameraCache = normalized.mainCamera

    set({
      spaces,
      activeCanvasId: normalized.activeCanvasId,
    })

    get().loadActiveFromSlot(normalized.activeCanvasId)
    persistEnabled = true
    workspaceHydrated = true

    const allCanvasItems = [
      ...mainItems,
      ...Object.values(spaces).flatMap((space) => space.items),
    ]
    const runtimeRecovered = await rehydrateMissingBlobsForItems(allCanvasItems)
    if (runtimeRecovered > 0) {
      console.info(
        `[media] recovered ${runtimeRecovered} blob(s) on post-hydrate media pass`,
      )
    }

    if (importDimsChanged) {
      saveWorkspaceToStorage(
        workspaceSnapshot({
          activeCanvasId: normalized.activeCanvasId,
          spaces,
        }),
      )
    }
  },

  isInsideSpace: () => get().activeCanvasId !== 'main',

  isOnMainCanvas: () => get().activeCanvasId === 'main',

  getSpaceName: (spaceId) =>
    get().spaces[spaceId]?.name ?? DEFAULT_SPACE_NAME,

  syncFromActiveStores: () => {
    const items = useCanvasItemsStore.getState().items
    const { strokes, annotationStrokes } = useStrokesStore.getState()
    const { activeCanvasId } = get()

    if (activeCanvasId === 'main') {
      mainItemsCache = items
      mainStrokesCache = strokes
      mainAnnotationStrokesCache = annotationStrokes
      return
    }

    set((state) => {
      const existing = state.spaces[activeCanvasId]
      if (!existing) return state
      return {
        spaces: {
          ...state.spaces,
          [activeCanvasId]: {
            ...existing,
            items,
            strokes,
            annotationStrokes,
          },
        },
      }
    })
  },

  flushActiveToSlot: () => {
    get().syncFromActiveStores()
  },

  loadActiveFromSlot: (canvasId) => {
    const { spaces } = get()
    let items: CanvasItem[]
    let strokes: Stroke[]
    let annotationStrokes: Stroke[]

    if (canvasId === 'main') {
      items = mainItemsCache
      strokes = mainStrokesCache
      annotationStrokes = mainAnnotationStrokesCache
    } else {
      const space = spaces[canvasId]
      if (!space) {
        items = []
        strokes = []
        annotationStrokes = []
      } else {
        items = space.items
        strokes = space.strokes
        annotationStrokes = space.annotationStrokes
      }
    }

    useCanvasItemsStore.setState({
      items,
      activeStickyStroke: null,
      selectedIds: [],
    })
    useStrokesStore.setState({
      strokes,
      annotationStrokes,
      activeStroke: null,
    })
    set({ activeCanvasId: canvasId })
  },

  persistWorkspace: () => {
    if (!persistEnabled) return
    get().flushActiveToSlot()
    scheduleSaveWorkspace(snapshotForPersist)
  },

  flushPersistWorkspace: () => {
    if (!persistEnabled) return
    flushScheduledWorkspaceSave(snapshotForPersist)
  },

  addSpaceData: (spaceId, name = DEFAULT_SPACE_NAME, opts) => {
    const clampedName = clampSpaceName(name)
    set((state) => ({
      spaces: {
        ...state.spaces,
        [spaceId]: {
          items: [],
          strokes: [],
          annotationStrokes: [],
          name: clampedName,
          snapshotId: null,
          camera: DEFAULT_SPACE_CAMERA,
        },
      },
    }))
    if (opts?.persist !== false) get().flushPersistWorkspace()
  },

  updateSpaceName: (spaceId, name) => {
    const space = get().spaces[spaceId]
    if (!space) return
    const clampedName = clampSpaceName(name)
    set((state) => {
      const current = state.spaces[spaceId]
      if (!current) return state
      return {
        spaces: {
          ...state.spaces,
          [spaceId]: { ...current, name: clampedName },
        },
      }
    })
    patchMainSpaceItem(spaceId, { name: clampedName })
    if (get().activeCanvasId === 'main') {
      useCanvasItemsStore.setState({ items: [...mainItemsCache] })
    }
    get().flushPersistWorkspace()
  },

  updateSpaceSnapshot: async (spaceId, snapshotDataUrl) => {
    const space = get().spaces[spaceId]
    if (!space) return

    let snapshotId = space.snapshotId
    if (snapshotDataUrl) {
      const saved = await putSnapshotFromDataUrl(spaceId, snapshotDataUrl)
      if (!saved) return
      snapshotId = spaceId
    } else if (snapshotId) {
      snapshotId = null
    }

    set((state) => {
      const current = state.spaces[spaceId]
      if (!current) return state
      const { snapshot: _legacy, ...rest } = current as SpaceCanvasData & {
        snapshot?: string
      }
      return {
        spaces: {
          ...state.spaces,
          [spaceId]: { ...rest, snapshotId },
        },
      }
    })
    patchMainSpaceItem(spaceId, { snapshotId })
    if (get().activeCanvasId === 'main') {
      useCanvasItemsStore.setState({ items: [...mainItemsCache] })
    }
    get().flushPersistWorkspace()
  },

  saveCameraForActive: (camera) => {
    const { activeCanvasId } = get()
    if (activeCanvasId === 'main') return
    get().flushActiveToSlot()
    set((state) => {
      const space = state.spaces[activeCanvasId]
      if (!space) return state
      return {
        spaces: {
          ...state.spaces,
          [activeCanvasId]: { ...space, camera },
        },
      }
    })
    get().flushPersistWorkspace()
  },

  getCameraForSpace: (spaceId) =>
    get().spaces[spaceId]?.camera ?? DEFAULT_SPACE_CAMERA,

  beginEnterSpace: (spaceId, cardRect) => {
    useCanvasItemsStore.getState().clearSelection({ silent: true })
    set({
      transition: { phase: 'entering', spaceId, cardRect },
    })
  },

  syncMainCamera: (transformRef) => {
    if (get().activeCanvasId !== 'main') return
    const camera = readCameraFromRef(transformRef)
    if (camera) mainCameraCache = camera
  },

  applyCameraForActiveCanvas: (transformRef) => {
    const { activeCanvasId, spaces } = get()
    if (!transformRef) return

    if (activeCanvasId === 'main') {
      const cached = mainCameraCache ?? DEFAULT_SPACE_CAMERA
      if (
        isUninitializedMainCamera(cached) ||
        !isCameraPlausible(cached, transformRef)
      ) {
        resetToCoverFit(transformRef)
      } else {
        applyCameraToRef(transformRef, cached)
      }
      const synced = readCameraFromRef(transformRef)
      if (synced) mainCameraCache = synced
      return
    }

    const space = spaces[activeCanvasId]
    const camera = space?.camera ?? DEFAULT_SPACE_CAMERA
    const isDefaultCamera =
      camera.positionX === DEFAULT_SPACE_CAMERA.positionX &&
      camera.positionY === DEFAULT_SPACE_CAMERA.positionY &&
      camera.scale === DEFAULT_SPACE_CAMERA.scale
    const isEmpty =
      !space ||
      (space.items.length === 0 &&
        space.strokes.length === 0 &&
        space.annotationStrokes.length === 0)

    if (isDefaultCamera && isEmpty) {
      resetToCoverFit(transformRef)
      requestAnimationFrame(() => {
        const synced = readCameraFromRef(transformRef)
        if (synced) get().saveCameraForActive(synced)
      })
    } else {
      applyCameraToRef(
        transformRef,
        isCameraPlausible(camera, transformRef) ? camera : DEFAULT_SPACE_CAMERA,
        { centerIfUninitialized: true },
      )
    }
  },

  completeEnterSpace: (transformRef) => {
    const { transition } = get()
    const spaceId = transition.spaceId
    if (!spaceId) return

    const savedMain = readCameraFromRef(transformRef)
    if (savedMain) mainCameraCache = savedMain

    get().flushActiveToSlot()
    get().loadActiveFromSlot(spaceId)
    clearHistory()

    get().applyCameraForActiveCanvas(transformRef)

    set({
      transition: { phase: 'idle', spaceId: null, cardRect: null },
    })
    get().flushPersistWorkspace()
  },

  beginExitSpace: (transformRef) => {
    const { activeCanvasId } = get()
    if (activeCanvasId === 'main') return

    const spaceItem = mainItemsCache.find(
      (i): i is SpaceCanvasItem =>
        i.id === activeCanvasId && i.type === 'space',
    )
    const cardRect =
      spaceItem && transformRef
        ? spaceCardClientRect(spaceItem, transformRef, mainCameraCache)
        : null

    set({
      transition: {
        phase: 'exiting',
        spaceId: activeCanvasId,
        cardRect,
      },
    })
  },

  captureExitSnapshot: async (transformRef, canvasEl) => {
    const { activeCanvasId } = get()
    if (activeCanvasId === 'main' || !canvasEl) return

    const camera = readCameraFromRef(transformRef)
    if (camera) get().saveCameraForActive(camera)

    get().flushActiveToSlot()

    const snapshot = await captureCanvasSnapshot(canvasEl)
    if (snapshot) await get().updateSpaceSnapshot(activeCanvasId, snapshot)
  },

  completeExitSpace: (transformRef) => {
    const { activeCanvasId, transition } = get()
    const spaceId = transition.spaceId ?? activeCanvasId
    if (spaceId === 'main' || !spaceId) return

    get().flushActiveToSlot()
    get().loadActiveFromSlot('main')
    clearHistory()

    const cached = mainCameraCache ?? DEFAULT_SPACE_CAMERA
    if (
      isUninitializedMainCamera(cached) ||
      !isCameraPlausible(cached, transformRef)
    ) {
      resetToCoverFit(transformRef)
    } else {
      applyCameraToRef(transformRef, cached)
    }
    const synced = readCameraFromRef(transformRef)
    if (synced) mainCameraCache = synced

    set({
      transition: { phase: 'idle', spaceId: null, cardRect: null },
    })
    get().flushPersistWorkspace()
  },

  setTransitionIdle: () => {
    set({
      transition: { phase: 'idle', spaceId: null, cardRect: null },
    })
  },
}))

function mediaIdsFromWorkspaceItems(items: CanvasItem[], into: Set<string>): void {
  for (const item of items) {
    if (item.type === 'image' || item.type === 'video') into.add(item.mediaId)
  }
}

/** Every canvas slot in the workspace — not just the active one. */
export function collectWorkspaceMediaIds(): Set<string> {
  const state = useCanvasWorkspaceStore.getState()
  state.flushActiveToSlot()
  const ids = new Set<string>()
  mediaIdsFromWorkspaceItems(mainItemsCache, ids)
  for (const space of Object.values(state.spaces)) {
    mediaIdsFromWorkspaceItems(space.items, ids)
  }
  return ids
}

/** Called by items/strokes stores whenever active canvas data changes. */
export function notifyWorkspacePersist() {
  useCanvasWorkspaceStore.getState().persistWorkspace()
}

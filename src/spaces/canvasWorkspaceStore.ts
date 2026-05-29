import { create } from 'zustand'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { clearHistory } from '../canvasHistory/canvasHistory'
import { useFeaturePlatePositionStore } from '../canvas/featurePlatePositionStore'
import { useStudioCentrePositionStore } from '../canvas/studioCentrePositionStore'
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
  ensureNotInFisheyeOverview,
  updateCanvasBarrelAfterCamera,
} from '../canvas/canvasBarrelPostProcess'
import {
  applyCameraToRef,
  isCameraPlausible,
  isUninitializedMainCamera,
  readCameraFromRef,
  resetToCoverFit,
  restoreMainCameraAfterPocketExit,
} from '../canvas/canvasCamera'
import { hardClampScale } from '../canvas/canvasZoomEdgeEase'
import { getCanvasHardMinScale } from '../drawing/canvasDimensions'
import { captureCanvasSnapshot } from './spaceSnapshot'
import { syncBackgroundMusicEnclosedAcoustics, invalidateBackgroundMusicAcousticsViewportSample } from '../sound/backgroundMusicAcoustics'
import type { SpaceCanvasItem } from '../canvasItems/types'
import {
  DEFAULT_SPACE_CAMERA,
  DEFAULT_SPACE_NAME,
  clampSpaceName,
  type ActiveCanvasId,
  type SpaceCamera,
  type SpaceCanvasData,
} from './types'

/** Reveal (0→1) — slow soft landing at the end. */
export const CANVAS_SWAP_FADE_IN_MS = 760
export const CANVAS_SWAP_FADE_IN_EASE = 'cubic-bezier(0.14, 1, 0.28, 1)'

/**
 * Exit reveal — sustained s-curve so visible motion fills the full duration.
 * The default IN ease is extremely front-loaded (~93% opacity by 25% of time),
 * leaving dead-air at the end that reads as abrupt when landing on the familiar
 * main canvas.
 */
export const CANVAS_SWAP_EXIT_REVEAL_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'

/** Blank (1→0) — quicker to leave, still eased (not a hard cut). */
export const CANVAS_SWAP_FADE_OUT_MS = 380
export const CANVAS_SWAP_FADE_OUT_EASE = 'cubic-bezier(0.58, 0, 0.78, 0.38)'

export type CanvasSwapMode = 'enter' | 'exit' | null
export type CanvasSwapPhase = 'blank' | 'reveal' | null

type CanvasWorkspaceState = {
  activeCanvasId: ActiveCanvasId
  spaces: Record<string, SpaceCanvasData>
  /** 0 while swapping; animates 1↔0 around workspace changes. */
  canvasFadeOpacity: number
  /** Canvas-colored veil crossfades with content during blank/reveal. */
  canvasVeilOpacity: number
  canvasFadeMs: number
  canvasFadeEase: string
  canvasSwapBusy: boolean
  canvasSwapMode: CanvasSwapMode
  canvasSwapPhase: CanvasSwapPhase
  /** Space id kept visible on the back pill through exit fade. */
  canvasSwapSpaceId: string | null
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
  insertMainCanvasItem: (item: CanvasItem) => void
  addSpaceData: (spaceId: string, name?: string, opts?: { persist?: boolean }) => void
  updateSpaceName: (spaceId: string, name: string) => void
  updateSpaceSnapshot: (spaceId: string, snapshotDataUrl: string | null) => Promise<void>
  saveCameraForActive: (camera: SpaceCamera) => void
  getCameraForSpace: (spaceId: string) => SpaceCamera
  enterSpace: (spaceId: string, transformRef: ReactZoomPanPinchContentRef | null) => void
  exitSpace: (
    transformRef: ReactZoomPanPinchContentRef | null,
    canvasEl?: HTMLElement | null,
  ) => void
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
/** Main pan/zoom captured the moment a pocket is opened — restored on exit. */
let mainCameraBeforePocket: SpaceCamera | null = null
let pendingMainCameraRestore = false

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
    studioCentrePosition: {
      x: useStudioCentrePositionStore.getState().x,
      y: useStudioCentrePositionStore.getState().y,
    },
    featurePlatePositions: useFeaturePlatePositionStore.getState().positions,
    storageVersion: WORKSPACE_STORAGE_VERSION,
  }
}

function snapshotForPersist(): LoadedWorkspace {
  const ws = useCanvasWorkspaceStore.getState()
  ws.flushActiveToSlot()
  return workspaceSnapshot(useCanvasWorkspaceStore.getState())
}

/** Fade out, swap workspace + camera while invisible, then fade in. */
function runCanvasSpaceSwap(
  set: (
    partial: Partial<
      Pick<
        CanvasWorkspaceState,
        | 'canvasFadeOpacity'
        | 'canvasVeilOpacity'
        | 'canvasFadeMs'
        | 'canvasFadeEase'
        | 'canvasSwapBusy'
        | 'canvasSwapMode'
        | 'canvasSwapPhase'
        | 'canvasSwapSpaceId'
      >
    >,
  ) => void,
  get: () => CanvasWorkspaceState,
  mode: 'enter' | 'exit',
  performSwap: () => void,
  opts?: { exitSpaceId?: string },
) {
  if (get().canvasSwapBusy) return

  set({
    canvasSwapBusy: true,
    canvasSwapMode: mode,
    canvasSwapPhase: 'blank',
    canvasSwapSpaceId: opts?.exitSpaceId ?? null,
    canvasFadeMs: CANVAS_SWAP_FADE_OUT_MS,
    canvasFadeEase: CANVAS_SWAP_FADE_OUT_EASE,
    canvasFadeOpacity: 1,
    canvasVeilOpacity: 0,
  })
  syncBackgroundMusicEnclosedAcoustics()

  requestAnimationFrame(() => {
    set({ canvasFadeOpacity: 0, canvasVeilOpacity: 1 })
  })

  window.setTimeout(() => {
    performSwap()
    syncBackgroundMusicEnclosedAcoustics()

    const revealEase =
      mode === 'exit'
        ? CANVAS_SWAP_EXIT_REVEAL_EASE
        : CANVAS_SWAP_FADE_IN_EASE
    set({
      canvasSwapPhase: 'reveal',
      canvasFadeMs: CANVAS_SWAP_FADE_IN_MS,
      canvasFadeEase: revealEase,
    })

    // Let swapped content paint at opacity 0 before crossfading in.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        set({ canvasFadeOpacity: 1, canvasVeilOpacity: 0 })
        window.setTimeout(() => {
          set({
            canvasSwapBusy: false,
            canvasSwapMode: null,
            canvasSwapPhase: null,
            canvasSwapSpaceId: null,
            canvasVeilOpacity: 0,
          })
          syncBackgroundMusicEnclosedAcoustics()
        }, CANVAS_SWAP_FADE_IN_MS)
      })
    })
  }, CANVAS_SWAP_FADE_OUT_MS)
}

export function isWorkspaceHydrated(): boolean {
  return workspaceHydrated
}

export const useCanvasWorkspaceStore = create<CanvasWorkspaceState>((set, get) => ({
  activeCanvasId: 'main',
  spaces: {},
  canvasFadeOpacity: 1,
  canvasVeilOpacity: 0,
  canvasFadeMs: CANVAS_SWAP_FADE_IN_MS,
  canvasFadeEase: CANVAS_SWAP_FADE_IN_EASE,
  canvasSwapBusy: false,
  canvasSwapMode: null,
  canvasSwapPhase: null,
  canvasSwapSpaceId: null,

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

    useStudioCentrePositionStore
      .getState()
      .hydrate(normalized.studioCentrePosition)
    useFeaturePlatePositionStore
      .getState()
      .hydrate(normalized.featurePlatePositions)

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

  insertMainCanvasItem: (item) => {
    mainItemsCache = [...mainItemsCache, item]
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

  enterSpace: (spaceId, transformRef) => {
    pendingMainCameraRestore = false
    const savedMain = readCameraFromRef(transformRef)
    if (savedMain) {
      mainCameraCache = savedMain
      mainCameraBeforePocket = savedMain
    }

    runCanvasSpaceSwap(set, get, 'enter', () => {
      useCanvasItemsStore.getState().clearSelection({ silent: true })
      get().flushActiveToSlot()
      get().loadActiveFromSlot(spaceId)
      clearHistory()
      // Pocket camera runs from App after pocket canvas dimensions paint.
      get().flushPersistWorkspace()
    })
  },

  syncMainCamera: (transformRef) => {
    if (get().activeCanvasId !== 'main' || !transformRef) return
    const camera = readCameraFromRef(transformRef)
    if (!camera) return

    const wrapper = transformRef.instance.wrapperComponent
    const hardMin = wrapper
      ? getCanvasHardMinScale(wrapper.offsetWidth, wrapper.offsetHeight)
      : camera.scale

    const next = {
      ...camera,
      scale: hardClampScale(camera.scale, hardMin),
    }

    const prev = mainCameraCache
    mainCameraCache = next

    if (
      !prev ||
      prev.positionX !== next.positionX ||
      prev.positionY !== next.positionY ||
      prev.scale !== next.scale
    ) {
      get().persistWorkspace()
    }
  },

  applyCameraForActiveCanvas: (transformRef) => {
    const { activeCanvasId, spaces } = get()
    if (!transformRef) return

    if (activeCanvasId === 'main') {
      if (pendingMainCameraRestore && mainCameraBeforePocket) {
        pendingMainCameraRestore = false
        const snapshot = mainCameraBeforePocket
        restoreMainCameraAfterPocketExit(transformRef, snapshot, {
          onComplete: () => {
            if (!transformRef) return
            updateCanvasBarrelAfterCamera(transformRef, { silent: true })
          },
        })
        mainCameraCache = snapshot
        return
      }

      const cached = mainCameraCache ?? DEFAULT_SPACE_CAMERA
      if (
        isUninitializedMainCamera(cached) ||
        !isCameraPlausible(cached, transformRef)
      ) {
        resetToCoverFit(transformRef)
      } else {
        applyCameraToRef(transformRef, cached)
      }
      ensureNotInFisheyeOverview(transformRef)
      const synced = readCameraFromRef(transformRef)
      if (synced) mainCameraCache = synced
      invalidateBackgroundMusicAcousticsViewportSample()
      updateCanvasBarrelAfterCamera(transformRef, { silent: true })
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
      ensureNotInFisheyeOverview(transformRef)
      updateCanvasBarrelAfterCamera(transformRef, { silent: true })
      requestAnimationFrame(() => {
        ensureNotInFisheyeOverview(transformRef)
        const synced = readCameraFromRef(transformRef)
        if (synced) get().saveCameraForActive(synced)
        updateCanvasBarrelAfterCamera(transformRef, { silent: true })
      })
    } else {
      applyCameraToRef(
        transformRef,
        isCameraPlausible(camera, transformRef) ? camera : DEFAULT_SPACE_CAMERA,
        { centerIfUninitialized: true },
      )
      ensureNotInFisheyeOverview(transformRef)
      updateCanvasBarrelAfterCamera(transformRef, { silent: true })
    }
  },

  exitSpace: (transformRef, canvasEl) => {
    const { activeCanvasId } = get()
    if (activeCanvasId === 'main') return

    const spaceId = activeCanvasId
    const camera = readCameraFromRef(transformRef)
    if (camera) get().saveCameraForActive(camera)

    pendingMainCameraRestore = mainCameraBeforePocket != null

    const swapDoneMs = CANVAS_SWAP_FADE_OUT_MS + CANVAS_SWAP_FADE_IN_MS
    if (canvasEl) {
      // Capture in parallel with the fade — never block the reveal crossfade.
      void captureCanvasSnapshot(canvasEl).then((snapshot) => {
        if (!snapshot) return
        window.setTimeout(() => {
          void get().updateSpaceSnapshot(spaceId, snapshot)
        }, swapDoneMs)
      })
    }

    runCanvasSpaceSwap(set, get, 'exit', () => {
      get().flushActiveToSlot()
      get().loadActiveFromSlot('main')
      clearHistory()
      // Camera restore runs from App after expanded canvas dimensions paint.
      get().flushPersistWorkspace()
    }, { exitSpaceId: spaceId })
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

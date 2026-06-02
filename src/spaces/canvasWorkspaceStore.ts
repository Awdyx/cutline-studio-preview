import { create } from 'zustand'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { clearHistory } from '../canvasHistory/canvasHistory'
import { useStudioCentrePositionStore } from '../canvas/studioCentrePositionStore'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import type { CanvasItem } from '../canvasItems/types'
import { useStrokesStore } from '../drawing/strokesStore'
import type { Stroke } from '../drawing/types'
import {
  cancelScheduledWorkspaceSave,
  loadWorkspaceFromStorage,
  flushScheduledWorkspaceSave,
  scheduleSaveWorkspace,
  saveWorkspaceToStorage,
  WORKSPACE_STORAGE_VERSION,
  type LoadedWorkspace,
} from './workspacePersistence'
import { backfillCanvasItemsImportDimensions } from '../media/mediaImportDimensions'
import { putSnapshotFromDataUrl } from '../media/mediaBlobStore'
import { normalizeLoadedWorkspace } from './normalizeWorkspace'
import { resetCanvasMinimapUiState } from '../canvas/canvasMinimapOpen'
import { useCanvasOverviewStore } from '../canvas/canvasOverviewStore'
import {
  applyCameraWhenTransformLayoutReady,
  applyCameraToRef,
  isCameraPlausible,
  isDefaultUncenteredCamera,
  isUninitializedMainCamera,
  readCameraFromRef,
  resetToCoverFit,
  restoreMainCameraAfterPocketExit,
  UNINITIALIZED_MAIN_CAMERA,
} from '../canvas/canvasCamera'
import {
  CANVAS_MAX_SCALE,
  canvasLayoutHeight,
  canvasLayoutWidth,
  getCanvasHardMinScale,
} from '../drawing/canvasDimensions'
import { defaultPocketStripState } from './pocketStripDimensions'
import { readPocketStripState, usePocketStripStore } from './pocketStripStore'
import { captureCanvasSnapshot } from './spaceSnapshot'
import { useSpaceDropStore } from './spaceDropStore'
import { syncBackgroundMusicEnclosedAcoustics, invalidateBackgroundMusicAcousticsViewportSample } from '../sound/backgroundMusicAcoustics'
import type { SpaceCanvasItem } from '../canvasItems/types'
import {
  DEFAULT_SPACE_NAME,
  clampSpaceName,
  type ActiveCanvasId,
  type PocketStripState,
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
  saveStripForActive: (strip: PocketStripState) => void
  getStripForSpace: (spaceId: string) => PocketStripState
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
/** Blocks persisting the library's pre-centerView camera during startup. */
let mainCameraApplied = false
/** Main pan/zoom captured the moment a pocket is opened — restored on exit. */
let mainCameraBeforePocket: SpaceCamera | null = null
let pendingMainCameraRestore = false
let activeSwapPerformTimeout: ReturnType<typeof setTimeout> | null = null
let activeSwapWatchdogTimeout: ReturnType<typeof setTimeout> | null = null

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
    storageVersion: WORKSPACE_STORAGE_VERSION,
  }
}

function snapshotForPersist(): LoadedWorkspace {
  const ws = useCanvasWorkspaceStore.getState()
  ws.flushActiveToSlot()
  return workspaceSnapshot(useCanvasWorkspaceStore.getState())
}

function resetCanvasSwapState(
  set: (
    partial: Partial<
      Pick<
        CanvasWorkspaceState,
        | 'canvasFadeOpacity'
        | 'canvasVeilOpacity'
        | 'canvasSwapBusy'
        | 'canvasSwapMode'
        | 'canvasSwapPhase'
        | 'canvasSwapSpaceId'
      >
    >,
  ) => void,
): void {
  set({
    canvasSwapBusy: false,
    canvasSwapMode: null,
    canvasSwapPhase: null,
    canvasSwapSpaceId: null,
    canvasVeilOpacity: 0,
    canvasFadeOpacity: 1,
  })
  syncBackgroundMusicEnclosedAcoustics()
}

function clearActiveSwapTimers(): void {
  if (activeSwapPerformTimeout != null) {
    clearTimeout(activeSwapPerformTimeout)
    activeSwapPerformTimeout = null
  }
  if (activeSwapWatchdogTimeout != null) {
    clearTimeout(activeSwapWatchdogTimeout)
    activeSwapWatchdogTimeout = null
  }
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
  opts?: {
    exitSpaceId?: string
    /** Runs after workspace swap; call `startReveal` once camera + layout are ready. */
    afterSwap?: (startReveal: () => void) => void
  },
) {
  if (get().canvasSwapBusy) return

  const beginReveal = () => {
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
            canvasFadeOpacity: 1,
          })
          syncBackgroundMusicEnclosedAcoustics()
        }, CANVAS_SWAP_FADE_IN_MS)
      })
    })
  }

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

  const swapWatchdogMs =
    CANVAS_SWAP_FADE_OUT_MS + CANVAS_SWAP_FADE_IN_MS + 240
  clearActiveSwapTimers()
  activeSwapWatchdogTimeout = window.setTimeout(() => {
    activeSwapWatchdogTimeout = null
    if (!get().canvasSwapBusy) return
    console.warn('[canvas] space swap watchdog — forcing reveal reset')
    resetCanvasSwapState(set)
  }, swapWatchdogMs)

  activeSwapPerformTimeout = window.setTimeout(() => {
    activeSwapPerformTimeout = null
    try {
      performSwap()
    } catch (err) {
      console.error('[canvas] space swap performSwap failed', err)
    }
    syncBackgroundMusicEnclosedAcoustics()

    const finishSwap = () => {
      if (activeSwapWatchdogTimeout != null) {
        clearTimeout(activeSwapWatchdogTimeout)
        activeSwapWatchdogTimeout = null
      }
      if (opts?.afterSwap) {
        opts.afterSwap(beginReveal)
        return
      }
      beginReveal()
    }

    try {
      finishSwap()
    } catch (err) {
      console.error('[canvas] space swap afterSwap failed', err)
      resetCanvasSwapState(set)
      if (activeSwapWatchdogTimeout != null) {
        clearTimeout(activeSwapWatchdogTimeout)
        activeSwapWatchdogTimeout = null
      }
    }
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
    mainCameraApplied = false
    const loaded = loadWorkspaceFromStorage()
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

    set({
      spaces,
      activeCanvasId: 'main',
    })

    get().loadActiveFromSlot('main')
    persistEnabled = true
    workspaceHydrated = true

    if (importDimsChanged || loaded.storageVersion < WORKSPACE_STORAGE_VERSION) {
      saveWorkspaceToStorage(
        workspaceSnapshot({
          activeCanvasId: 'main',
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
          strip: defaultPocketStripState(),
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
      return {
        spaces: {
          ...state.spaces,
          [spaceId]: { ...current, snapshotId },
        },
      }
    })
    patchMainSpaceItem(spaceId, { snapshotId })
    if (get().activeCanvasId === 'main') {
      useCanvasItemsStore.setState({ items: [...mainItemsCache] })
    }
    get().flushPersistWorkspace()
  },

  saveStripForActive: (strip) => {
    const { activeCanvasId } = get()
    if (activeCanvasId === 'main') return
    get().flushActiveToSlot()
    set((state) => {
      const space = state.spaces[activeCanvasId]
      if (!space) return state
      return {
        spaces: {
          ...state.spaces,
          [activeCanvasId]: { ...space, strip },
        },
      }
    })
    get().flushPersistWorkspace()
  },

  getStripForSpace: (spaceId) =>
    get().spaces[spaceId]?.strip ?? defaultPocketStripState(),

  enterSpace: (spaceId, transformRef) => {
    pendingMainCameraRestore = false
    const savedMain = readCameraFromRef(transformRef)
    if (savedMain) {
      mainCameraCache = savedMain
      mainCameraBeforePocket = savedMain
    }

    runCanvasSpaceSwap(
      set,
      get,
      'enter',
      () => {
        useCanvasItemsStore.getState().clearSelection({ silent: true })
        get().flushActiveToSlot()
        get().loadActiveFromSlot(spaceId)
        clearHistory()
        get().flushPersistWorkspace()
      },
      {
        afterSwap: (startReveal) => {
          startReveal()
        },
      },
    )
  },

  syncMainCamera: (transformRef) => {
    if (get().activeCanvasId !== 'main' || !transformRef) return
    if (!mainCameraApplied) return
    const camera = readCameraFromRef(transformRef)
    if (!camera) return

    const wrapper = transformRef.instance.wrapperComponent
    const hardMin = wrapper
      ? getCanvasHardMinScale(wrapper.offsetWidth, wrapper.offsetHeight)
      : camera.scale

    const next = {
      ...camera,
      scale: Math.min(CANVAS_MAX_SCALE, Math.max(hardMin, camera.scale)),
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
    const { activeCanvasId } = get()
    if (!transformRef) return
    if (activeCanvasId !== 'main') return

    if (pendingMainCameraRestore && mainCameraBeforePocket) {
      pendingMainCameraRestore = false
      const snapshot = mainCameraBeforePocket
      restoreMainCameraAfterPocketExit(transformRef, snapshot, {
        onComplete: () => {},
      })
      mainCameraCache = snapshot
      return
    }

    const cached = mainCameraCache ?? UNINITIALIZED_MAIN_CAMERA
    if (
      isUninitializedMainCamera(cached) ||
      isDefaultUncenteredCamera(cached, transformRef) ||
      !isCameraPlausible(cached, transformRef)
    ) {
      resetToCoverFit(transformRef)
    } else {
      applyCameraToRef(transformRef, cached)
    }
    useCanvasOverviewStore.getState().setEngaged(false)
    resetCanvasMinimapUiState()
    const synced = readCameraFromRef(transformRef)
    if (synced) mainCameraCache = synced
    mainCameraApplied = true
    invalidateBackgroundMusicAcousticsViewportSample()
  },

  exitSpace: (transformRef, canvasEl) => {
    const { activeCanvasId } = get()
    if (activeCanvasId === 'main') return

    const spaceId = activeCanvasId
    const strip = readPocketStripState()
    get().saveStripForActive(strip)

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

    const snapshot = mainCameraBeforePocket
    runCanvasSpaceSwap(
      set,
      get,
      'exit',
      () => {
        // afterSwap owns camera restore once expanded layout has painted.
        pendingMainCameraRestore = false
        get().flushActiveToSlot()
        get().loadActiveFromSlot('main')
        clearHistory()
        get().flushPersistWorkspace()
      },
      {
        exitSpaceId: spaceId,
        afterSwap: (startReveal) => {
          usePocketStripStore.getState().reset()
          if (!transformRef) {
            startReveal()
            return
          }
          applyCameraWhenTransformLayoutReady(
            transformRef,
            canvasLayoutWidth(),
            canvasLayoutHeight(),
            () => {
              if (snapshot) {
                restoreMainCameraAfterPocketExit(transformRef, snapshot, {
                  onComplete: startReveal,
                })
                return
              }
              get().applyCameraForActiveCanvas(transformRef)
              startReveal()
            },
          )
        },
      },
    )
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

/** Stops all workspace persistence writes until next app bootstrap. */
export function disableWorkspacePersist(): void {
  persistEnabled = false
  cancelScheduledWorkspaceSave()
}

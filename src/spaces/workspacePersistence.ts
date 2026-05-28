import { loadCanvasItemsFromStorage } from '../canvasItems/canvasItemsPersistence'
import type { CanvasItem } from '../canvasItems/types'
import { stripLegacyMediaFromItems } from '../media/stripLegacyMediaFields'
import { loadStrokesFromStorage } from '../drawing/strokesPersistence'
import type { Stroke } from '../drawing/types'
import { isUninitializedMainCamera } from '../canvas/canvasCamera'
import { CANVAS_MAX_SCALE } from '../drawing/canvasDimensions'
import {
  DEFAULT_SPACE_CAMERA,
  DEFAULT_SPACE_NAME,
  clampSpaceName,
  type ActiveCanvasId,
  type SpaceCamera,
  type SpaceCanvasData,
} from './types'

import { scopedStorageKey } from '../storage/storageScope'

export const WORKSPACE_STORAGE_KEY = scopedStorageKey('cutline-workspace-v1')
export const WORKSPACE_STORAGE_VERSION = 2

type PersistedSpace = {
  items: CanvasItem[]
  strokes: Stroke[]
  annotationStrokes?: Stroke[]
  name: string
  snapshotId?: string | null
  /** @deprecated v1 inline snapshot — migrated to IndexedDB */
  snapshot?: string | null
  camera?: SpaceCamera
}

type PersistedPayload = {
  version: number
  mainItems: CanvasItem[]
  mainStrokes: Stroke[]
  mainAnnotationStrokes?: Stroke[]
  spaces: Record<string, PersistedSpace>
  activeCanvasId: ActiveCanvasId
  mainCamera?: SpaceCamera
}

export type LoadedWorkspace = {
  mainItems: CanvasItem[]
  mainStrokes: Stroke[]
  mainAnnotationStrokes: Stroke[]
  spaces: Record<string, SpaceCanvasData & { snapshot?: string }>
  activeCanvasId: ActiveCanvasId
  mainCamera: SpaceCamera | null
  /** True when assembled from legacy per-layer storage keys. */
  migratedFromLegacy?: boolean
  storageVersion: number
}

function normalizeMainCamera(raw: unknown): SpaceCamera | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as SpaceCamera
  if (
    typeof o.positionX !== 'number' ||
    typeof o.positionY !== 'number' ||
    typeof o.scale !== 'number'
  ) {
    return null
  }
  const camera: SpaceCamera = {
    positionX: o.positionX,
    positionY: o.positionY,
    scale: o.scale,
  }
  if (
    !Number.isFinite(camera.scale) ||
    camera.scale <= 0 ||
    camera.scale > CANVAS_MAX_SCALE + 0.001
  ) {
    return null
  }
  return isUninitializedMainCamera(camera) ? null : camera
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingSnapshot: (() => LoadedWorkspace) | null = null

/** Debounced save — snapshot is read when the timer fires, not when scheduled. */
export function scheduleSaveWorkspace(getSnapshot: () => LoadedWorkspace): void {
  pendingSnapshot = getSnapshot
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    const snapshot = pendingSnapshot
    pendingSnapshot = null
    if (snapshot) saveWorkspaceToStorage(snapshot())
  }, 500)
}

/** Immediately persist the latest workspace snapshot (e.g. on page unload). */
export function flushScheduledWorkspaceSave(getSnapshot: () => LoadedWorkspace): void {
  pendingSnapshot = getSnapshot
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  const snapshot = pendingSnapshot
  pendingSnapshot = null
  if (snapshot) saveWorkspaceToStorage(snapshot())
}

export function saveWorkspaceToStorage(data: LoadedWorkspace): void {
  try {
    const serialized = serializeWorkspace(data)
    if (serialized === null) {
      console.warn('[spaces] workspace payload too large — save skipped')
      return
    }
    localStorage.setItem(WORKSPACE_STORAGE_KEY, serialized)
  } catch (err) {
    console.warn('[spaces] failed to save workspace', err)
  }
}

const MAX_WORKSPACE_BYTES = 8 * 1024 * 1024

function serializeWorkspace(data: LoadedWorkspace): string | null {
  const spaces: Record<string, PersistedSpace> = {}
  for (const [id, space] of Object.entries(data.spaces)) {
    spaces[id] = {
      items: stripLegacyMediaFromItems(space.items),
      strokes: space.strokes,
      annotationStrokes:
        space.annotationStrokes.length > 0
          ? space.annotationStrokes
          : undefined,
      name: space.name,
      snapshotId: space.snapshotId,
      camera: space.camera,
    }
  }

  const payload: PersistedPayload = {
    version: WORKSPACE_STORAGE_VERSION,
    mainItems: stripLegacyMediaFromItems(data.mainItems),
    mainStrokes: data.mainStrokes,
    mainAnnotationStrokes:
      data.mainAnnotationStrokes.length > 0
        ? data.mainAnnotationStrokes
        : undefined,
    spaces,
    activeCanvasId: data.activeCanvasId,
  }

  const serialized = JSON.stringify(payload)
  if (serialized.length > MAX_WORKSPACE_BYTES) return null
  return serialized
}

type LoadedSpaceRow = SpaceCanvasData & { snapshot?: string }

function normalizeSpace(raw: unknown, spaceId: string): LoadedSpaceRow | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as PersistedSpace
  if (!Array.isArray(o.items)) return null

  const camera = o.camera
  const normalizedCamera: SpaceCamera =
    camera &&
    typeof camera.positionX === 'number' &&
    typeof camera.positionY === 'number' &&
    typeof camera.scale === 'number'
      ? camera
      : DEFAULT_SPACE_CAMERA

  const snapshotId =
    typeof o.snapshotId === 'string'
      ? o.snapshotId
      : typeof o.snapshot === 'string' && o.snapshot.length > 0
        ? spaceId
        : null

  return {
    items: o.items,
    strokes: Array.isArray(o.strokes) ? o.strokes : [],
    annotationStrokes: Array.isArray(o.annotationStrokes)
      ? o.annotationStrokes
      : [],
    name:
      typeof o.name === 'string'
        ? clampSpaceName(o.name)
        : DEFAULT_SPACE_NAME,
    snapshotId,
    camera: normalizedCamera,
    ...(typeof o.snapshot === 'string' && o.snapshot.length > 0
      ? { snapshot: o.snapshot }
      : {}),
  }
}

export function loadWorkspaceFromStorage(): LoadedWorkspace {
  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedPayload
      const storageVersion =
        typeof parsed.version === 'number' ? parsed.version : 1
      const spaces: Record<string, LoadedSpaceRow> = {}
      if (parsed.spaces && typeof parsed.spaces === 'object') {
        for (const [id, spaceRaw] of Object.entries(parsed.spaces)) {
          const space = normalizeSpace(spaceRaw, id)
          if (space) spaces[id] = space
        }
      }
      const mainCamera = normalizeMainCamera(parsed.mainCamera)

      return {
        mainItems: Array.isArray(parsed.mainItems) ? parsed.mainItems : [],
        mainStrokes: Array.isArray(parsed.mainStrokes) ? parsed.mainStrokes : [],
        mainAnnotationStrokes: Array.isArray(parsed.mainAnnotationStrokes)
          ? parsed.mainAnnotationStrokes
          : [],
        spaces,
        activeCanvasId:
          parsed.activeCanvasId === 'main' ||
          (typeof parsed.activeCanvasId === 'string' &&
            parsed.activeCanvasId in spaces)
            ? parsed.activeCanvasId
            : 'main',
        mainCamera,
        storageVersion,
      }
    }
  } catch (err) {
    console.warn('[spaces] failed to load workspace', err)
  }

  return migrateLegacyStorage()
}

function migrateLegacyStorage(): LoadedWorkspace {
  const mainItems = loadCanvasItemsFromStorage()
  const { strokes, annotationStrokes } = loadStrokesFromStorage()
  const spaces: Record<string, LoadedSpaceRow> = {}

  for (const item of mainItems) {
    if (item.type !== 'space') continue
    const legacy = item as { snapshot?: string | null; snapshotId?: string | null }
    spaces[item.id] = {
      items: [],
      strokes: [],
      annotationStrokes: [],
      name: item.name,
      snapshotId:
        legacy.snapshotId ??
        (typeof legacy.snapshot === 'string' && legacy.snapshot.length > 0
          ? item.id
          : null),
      ...(typeof legacy.snapshot === 'string' && legacy.snapshot.length > 0
        ? { snapshot: legacy.snapshot }
        : {}),
      camera: DEFAULT_SPACE_CAMERA,
    }
  }

  return {
    mainItems,
    mainStrokes: strokes,
    mainAnnotationStrokes: annotationStrokes,
    spaces,
    activeCanvasId: 'main',
    mainCamera: null,
    migratedFromLegacy: true,
    storageVersion: 1,
  }
}

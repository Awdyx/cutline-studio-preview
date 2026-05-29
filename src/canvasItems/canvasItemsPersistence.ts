import type { CanvasLayer } from '../canvasLock/layer'
import { generateStrokeId } from '../drawing/strokeId'
import { strokeToSvgPath } from '../drawing/strokePath'
import type { DrawTool, Stroke } from '../drawing/types'
import {
  DEFAULT_SPACE_PREVIEW_PAN,
  resolveSpacePreviewPan,
} from '../spaces/spacePreviewPan'
import { DEFAULT_SPACE_NAME } from '../spaces/types'
import { DEFAULT_SPACE_NAME_ALIGNMENT, normalizeTextAlignment } from './textAlignment'
import type { CanvasItem, StickyColorId } from './types'

function normalizeStickyColor(value: unknown): StickyColorId | undefined {
  if (value === 'yellow' || value === 'pink' || value === 'blue') return value
  return undefined
}
import { studyHubDimensionsForWidth } from './studyHubBounds'

import { scopedStorageKey } from '../storage/storageScope'
import { filterItemsForStudioCentrePersist } from '../canvas/studioCentre'

export const CANVAS_ITEMS_STORAGE_KEY = scopedStorageKey('cutline-canvas-items-v1')
const STORAGE_VERSION = 1
const MAX_ITEM_BYTES = 5 * 1024 * 1024

type PersistedPayload = {
  version: number
  items: CanvasItem[]
}

function normalizeStroke(raw: unknown): Stroke | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<Stroke>
  if (!Array.isArray(o.points) || o.points.length < 3) return null

  const points = o.points.filter(
    (p): p is Stroke['points'][number] =>
      !!p &&
      typeof p === 'object' &&
      typeof (p as Stroke['points'][number]).x === 'number' &&
      typeof (p as Stroke['points'][number]).y === 'number',
  )
  if (points.length < 3) return null

  const tool: DrawTool = o.tool === 'highlighter' ? 'highlighter' : 'pen'
  const stroke: Stroke = {
    id: typeof o.id === 'string' ? o.id : generateStrokeId(),
    points,
    color: typeof o.color === 'string' ? o.color : '#4f5568',
    size: typeof o.size === 'number' ? o.size : 4,
    tool,
  }
  stroke.path =
    typeof o.path === 'string' && o.path.length > 0
      ? o.path
      : strokeToSvgPath(stroke, false)
  return stroke
}

function itemByteSize(item: CanvasItem): number {
  try {
    return JSON.stringify(item).length
  } catch {
    return Infinity
  }
}

function normalizeItem(raw: unknown): CanvasItem | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<CanvasItem>
  if (typeof o.id !== 'string' || typeof o.type !== 'string') return null
  if (typeof o.x !== 'number' || typeof o.y !== 'number') return null
  if (typeof o.zIndex !== 'number') return null
  if (typeof o.width !== 'number' || typeof o.height !== 'number') return null

  if (itemByteSize(o as CanvasItem) > MAX_ITEM_BYTES) {
    console.warn(`[canvas] skipped oversize item ${o.id} on load`)
    return null
  }

  const layerRaw = (o as { layer?: string }).layer
  const layer: CanvasLayer | undefined =
    layerRaw === 'annotation' ? 'annotation' : undefined

  if (o.type === 'sticky') {
    const strokesRaw = (o as { strokes?: unknown }).strokes
    const strokes = Array.isArray(strokesRaw)
      ? strokesRaw.map(normalizeStroke).filter((s): s is Stroke => s !== null)
      : []
    const annRaw = (o as { annotationStrokes?: unknown }).annotationStrokes
    const annotationStrokes = Array.isArray(annRaw)
      ? annRaw.map(normalizeStroke).filter((s): s is Stroke => s !== null)
      : []
    return {
      id: o.id,
      type: 'sticky',
      x: o.x,
      y: o.y,
      zIndex: o.zIndex,
      width: o.width,
      height: o.height,
      text: typeof (o as { text?: string }).text === 'string' ? (o as { text: string }).text : '',
      strokes,
      ...(annotationStrokes.length > 0 ? { annotationStrokes } : {}),
      textAlign: normalizeTextAlignment((o as { textAlign?: unknown }).textAlign),
      ...(normalizeStickyColor((o as { color?: unknown }).color) !== undefined
        ? { color: normalizeStickyColor((o as { color?: unknown }).color) }
        : {}),
      ...(layer ? { layer } : {}),
    }
  }

  if (o.type === 'text') {
    return {
      id: o.id,
      type: 'text',
      x: o.x,
      y: o.y,
      zIndex: o.zIndex,
      width: o.width,
      height: o.height,
      text: typeof (o as { text?: string }).text === 'string' ? (o as { text: string }).text : '',
      textAlign: normalizeTextAlignment((o as { textAlign?: unknown }).textAlign),
      ...(layer ? { layer } : {}),
    }
  }

  if (o.type === 'image' || o.type === 'video') {
    const legacySrc = (o as { src?: string }).src
    const mediaId =
      typeof (o as { mediaId?: string }).mediaId === 'string'
        ? (o as { mediaId: string }).mediaId
        : typeof legacySrc === 'string' && legacySrc.length > 0
          ? o.id
          : null
    if (!mediaId) return null
    const importWidth = (o as { importWidth?: number }).importWidth
    const importHeight = (o as { importHeight?: number }).importHeight
    const stickyIdRaw = (o as { stickyId?: unknown }).stickyId
    const stickyId =
      typeof stickyIdRaw === 'string' && stickyIdRaw.length > 0
        ? stickyIdRaw
        : undefined
    const originRaw = (o as { mainCanvasOrigin?: unknown }).mainCanvasOrigin
    const mainCanvasOrigin =
      originRaw &&
      typeof originRaw === 'object' &&
      typeof (originRaw as { x?: unknown }).x === 'number' &&
      typeof (originRaw as { y?: unknown }).y === 'number' &&
      typeof (originRaw as { zIndex?: unknown }).zIndex === 'number'
        ? {
            x: (originRaw as { x: number }).x,
            y: (originRaw as { y: number }).y,
            zIndex: (originRaw as { zIndex: number }).zIndex,
          }
        : undefined
    return {
      id: o.id,
      type: o.type,
      x: o.x,
      y: o.y,
      zIndex: o.zIndex,
      width: o.width,
      height: o.height,
      mediaId,
      ...(typeof importWidth === 'number' ? { importWidth } : {}),
      ...(typeof importHeight === 'number' ? { importHeight } : {}),
      ...(stickyId ? { stickyId } : {}),
      ...(mainCanvasOrigin ? { mainCanvasOrigin } : {}),
      ...(layer ? { layer } : {}),
      ...(legacySrc ? { src: legacySrc } : {}),
    } as CanvasItem
  }

  if (o.type === 'space') {
    const name =
      typeof (o as { name?: string }).name === 'string'
        ? (o as { name: string }).name
        : DEFAULT_SPACE_NAME
    const snapshotIdRaw = (o as { snapshotId?: unknown }).snapshotId
    const snapshotRaw = (o as { snapshot?: unknown }).snapshot
    const snapshotId =
      typeof snapshotIdRaw === 'string' && snapshotIdRaw.length > 0
        ? snapshotIdRaw
        : typeof snapshotRaw === 'string' && snapshotRaw.length > 0
          ? o.id
          : null
    const previewPanRaw = (o as {
      previewPan?: { x?: unknown; y?: unknown; scale?: unknown }
    }).previewPan
    const previewPan = previewPanRaw
      ? resolveSpacePreviewPan({
          x:
            typeof previewPanRaw.x === 'number' ? previewPanRaw.x : undefined,
          y:
            typeof previewPanRaw.y === 'number' ? previewPanRaw.y : undefined,
          scale:
            typeof previewPanRaw.scale === 'number'
              ? previewPanRaw.scale
              : undefined,
        })
      : DEFAULT_SPACE_PREVIEW_PAN
    return {
      id: o.id,
      type: 'space',
      x: o.x,
      y: o.y,
      zIndex: o.zIndex,
      width: o.width,
      height: o.height,
      name,
      snapshotId,
      previewPan,
      textAlign:
        (o as { textAlign?: unknown }).textAlign != null
          ? normalizeTextAlignment((o as { textAlign?: unknown }).textAlign)
          : DEFAULT_SPACE_NAME_ALIGNMENT,
      ...(layer ? { layer } : {}),
      ...(typeof snapshotRaw === 'string' && snapshotRaw.length > 0
        ? { snapshot: snapshotRaw }
        : {}),
    } as CanvasItem
  }

  if (o.type === 'study_hub' || o.type === 'study_topic') {
    const subjectId = (o as { subjectId?: string }).subjectId
    if (
      subjectId !== 'hubs' &&
      subjectId !== 'cels' &&
      subjectId !== 'chem' &&
      subjectId !== 'phsi'
    ) {
      return null
    }
    const strokesRaw = (o as { strokes?: unknown }).strokes
    const strokes = Array.isArray(strokesRaw)
      ? strokesRaw.map(normalizeStroke).filter((s): s is Stroke => s !== null)
      : []
    const annRaw = (o as { annotationStrokes?: unknown }).annotationStrokes
    const annotationStrokes = Array.isArray(annRaw)
      ? annRaw.map(normalizeStroke).filter((s): s is Stroke => s !== null)
      : []
    const spawnScaleRaw = (o as { spawnScale?: number }).spawnScale
    const spawnScale =
      typeof spawnScaleRaw === 'number' &&
      Number.isFinite(spawnScaleRaw) &&
      spawnScaleRaw > 0
        ? spawnScaleRaw
        : undefined
    const { width, height } = studyHubDimensionsForWidth(o.width)
    return {
      id: o.id,
      type: 'study_hub',
      x: o.x,
      y: o.y,
      zIndex: o.zIndex,
      width,
      height,
      subjectId,
      strokes,
      ...(annotationStrokes.length > 0 ? { annotationStrokes } : {}),
      ...(spawnScale !== undefined ? { spawnScale } : {}),
      ...(layer ? { layer } : {}),
    }
  }

  return null
}

export function loadCanvasItemsFromStorage(): CanvasItem[] {
  try {
    const raw = localStorage.getItem(CANVAS_ITEMS_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as PersistedPayload | CanvasItem[]
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.items)
        ? parsed.items
        : []

    return filterItemsForStudioCentrePersist(
      list
        .map(normalizeItem)
        .filter((item): item is CanvasItem => item !== null),
    )
  } catch (err) {
    console.warn('[canvas] failed to load canvas items from localStorage', err)
    return []
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

export function scheduleSaveCanvasItems(items: CanvasItem[]): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    saveCanvasItemsToStorage(items)
  }, 500)
}

export function saveCanvasItemsToStorage(items: CanvasItem[]): void {
  try {
    const kept = filterItemsForStudioCentrePersist(items).filter((item) => {
      if (itemByteSize(item) > MAX_ITEM_BYTES) {
        console.warn(`[canvas] skipped oversize item ${item.id} on save`)
        return false
      }
      return true
    })

    const payload: PersistedPayload = {
      version: STORAGE_VERSION,
      items: kept,
    }
    localStorage.setItem(CANVAS_ITEMS_STORAGE_KEY, JSON.stringify(payload))
  } catch (err) {
    console.warn('[canvas] failed to save canvas items to localStorage', err)
  }
}

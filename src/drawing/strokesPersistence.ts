import type { Stroke } from './types'
import { generateStrokeId } from './strokeId'
import { strokeToSvgPath } from './strokePath'
import {
  CONTRAST_INK,
  DEFAULT_HIGHLIGHTER_COLOR,
  normalizeStoredPenInk,
} from './colorUtils'
import type { DrawTool } from './types'

import { scopedStorageKey } from '../storage/storageScope'

export const STROKES_STORAGE_KEY = scopedStorageKey('cutline-strokes-v1')
const STORAGE_VERSION = 2
const MAX_BYTES = 4 * 1024 * 1024

type PersistedPayload = {
  version: number
  strokes: Stroke[]
  annotationStrokes?: Stroke[]
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
    color:
      typeof o.color === 'string'
        ? tool === 'pen'
          ? normalizeStoredPenInk(o.color)
          : o.color
        : tool === 'pen'
          ? CONTRAST_INK
          : DEFAULT_HIGHLIGHTER_COLOR,
    size: typeof o.size === 'number' ? o.size : 4,
    tool,
    ...(typeof o.zIndex === 'number' ? { zIndex: o.zIndex } : {}),
  }

  stroke.path =
    typeof o.path === 'string' && o.path.length > 0
      ? o.path
      : strokeToSvgPath(stroke, false)

  return stroke
}

function normalizeStrokeList(raw: unknown): Stroke[] {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeStroke).filter((s): s is Stroke => s !== null)
}

export function loadStrokesFromStorage(): {
  strokes: Stroke[]
  annotationStrokes: Stroke[]
} {
  try {
    const raw = localStorage.getItem(STROKES_STORAGE_KEY)
    if (!raw) return { strokes: [], annotationStrokes: [] }

    const parsed = JSON.parse(raw) as PersistedPayload | Stroke[]
    if (Array.isArray(parsed)) {
      return { strokes: normalizeStrokeList(parsed), annotationStrokes: [] }
    }

    const strokes = normalizeStrokeList(parsed?.strokes)
    const annotationStrokes = normalizeStrokeList(parsed?.annotationStrokes)
    return { strokes, annotationStrokes }
  } catch (err) {
    console.warn('[DRAW] failed to load strokes from localStorage', err)
    return { strokes: [], annotationStrokes: [] }
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

export function scheduleSaveStrokes(
  strokes: Stroke[],
  annotationStrokes: Stroke[] = [],
): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    saveStrokesToStorage(strokes, annotationStrokes)
  }, 500)
}

export function saveStrokesToStorage(
  strokes: Stroke[],
  annotationStrokes: Stroke[] = [],
): void {
  try {
    const serialize = (list: Stroke[]) =>
      list.map(({ id, points, color, size, tool, path, zIndex }) => ({
        id,
        points,
        color,
        size,
        tool,
        path,
        ...(typeof zIndex === 'number' ? { zIndex } : {}),
      }))

    const payload: PersistedPayload = {
      version: STORAGE_VERSION,
      strokes: serialize(strokes),
      annotationStrokes:
        annotationStrokes.length > 0 ? serialize(annotationStrokes) : undefined,
    }
    const serialized = JSON.stringify(payload)
    if (serialized.length > MAX_BYTES) {
      console.warn(
        `[DRAW] strokes payload ${(serialized.length / 1024 / 1024).toFixed(2)}MB exceeds 4MB — skipping save`,
      )
      return
    }
    localStorage.setItem(STROKES_STORAGE_KEY, serialized)
  } catch (err) {
    console.warn('[DRAW] failed to save strokes to localStorage', err)
  }
}

import { create } from 'zustand'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import type { CanvasItem } from '../canvasItems/types'
import { effectiveCanvasLocked } from '../canvasLock/layer'
import { useCanvasLockStore } from '../canvasLock/canvasLockStore'
import { useStrokesStore } from '../drawing/strokesStore'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import type { Stroke } from '../drawing/types'

const HISTORY_CAP = 50

export type CanvasSnapshot = {
  strokes: Stroke[]
  annotationStrokes: Stroke[]
  items: CanvasItem[]
}

let past: CanvasSnapshot[] = []
let future: CanvasSnapshot[] = []

export const useHistoryUiStore = create<{
  canUndo: boolean
  canRedo: boolean
}>(() => ({
  canUndo: false,
  canRedo: false,
}))

function syncHistoryUi() {
  useHistoryUiStore.setState({ canUndo: canUndo(), canRedo: canRedo() })
}

function mediaIdsFromItems(items: CanvasItem[]): Set<string> {
  const ids = new Set<string>()
  for (const item of items) {
    if (item.type === 'image' || item.type === 'video') ids.add(item.mediaId)
  }
  return ids
}

/** Media still reachable via undo, redo, or the live canvas. */
export function collectHistoryMediaIds(): Set<string> {
  const ids = mediaIdsFromItems(useCanvasItemsStore.getState().items)
  for (const snap of past) {
    for (const id of mediaIdsFromItems(snap.items)) ids.add(id)
  }
  for (const snap of future) {
    for (const id of mediaIdsFromItems(snap.items)) ids.add(id)
  }
  return ids
}

function cloneStrokes(strokes: Stroke[]): Stroke[] {
  return JSON.parse(JSON.stringify(strokes)) as Stroke[]
}

function cloneItems(items: CanvasItem[]): CanvasItem[] {
  return JSON.parse(JSON.stringify(items)) as CanvasItem[]
}

function snapshotNow(): CanvasSnapshot {
  const strokeState = useStrokesStore.getState()
  return {
    strokes: cloneStrokes(strokeState.strokes),
    annotationStrokes: cloneStrokes(strokeState.annotationStrokes),
    items: cloneItems(useCanvasItemsStore.getState().items),
  }
}

function strokesEqual(a: Stroke[], b: Stroke[]): boolean {
  if (a.length !== b.length) return false
  return a.every((s, i) => s.id === b[i]?.id)
}

function applySnapshot(snap: CanvasSnapshot) {
  useStrokesStore.setState({
    strokes: cloneStrokes(snap.strokes),
    annotationStrokes: cloneStrokes(snap.annotationStrokes),
    activeStroke: null,
  })
  useCanvasItemsStore.setState({
    items: cloneItems(snap.items),
    activeStickyStroke: null,
  })
  useCanvasWorkspaceStore.getState().flushPersistWorkspace()
}

/** Call immediately before a user-visible canvas mutation. */
export function pushUndoSnapshot(): void {
  past.push(snapshotNow())
  if (past.length > HISTORY_CAP) past = past.slice(-HISTORY_CAP)
  future = []
  syncHistoryUi()
}

export function cancelLastUndoSnapshotIfEraseUnchanged(): void {
  if (past.length === 0) return
  const before = past[past.length - 1]
  const current = useStrokesStore.getState()
  const locked = effectiveCanvasLocked(useCanvasLockStore.getState().isLocked)
  const unchanged = locked
    ? strokesEqual(before.annotationStrokes, current.annotationStrokes)
    : strokesEqual(before.strokes, current.strokes)
  if (unchanged) past.pop()
  syncHistoryUi()
}

export function canUndo(): boolean {
  return past.length > 0
}

export function canRedo(): boolean {
  return future.length > 0
}

export function undo(): boolean {
  if (!canUndo()) return false
  future.unshift(snapshotNow())
  const previous = past.pop()!
  applySnapshot(previous)
  syncHistoryUi()
  return true
}

export function redo(): boolean {
  if (!canRedo()) return false
  past.push(snapshotNow())
  const next = future.shift()!
  applySnapshot(next)
  syncHistoryUi()
  return true
}

export function clearHistory(): void {
  past = []
  future = []
  syncHistoryUi()
}

/** Inline data URLs still present on items in undo/redo stacks. */
export function findHistoryMediaSrc(
  mediaId: string,
  itemId?: string,
): string | null {
  const candidates = [
    ...useCanvasItemsStore.getState().items,
    ...past.flatMap((snap) => snap.items),
    ...future.flatMap((snap) => snap.items),
  ]

  for (const item of candidates) {
    if (item.type !== 'image' && item.type !== 'video') continue
    if (item.mediaId !== mediaId && item.id !== itemId) continue
    const src = (item as { src?: string }).src
    if (typeof src === 'string' && src.startsWith('data:')) return src
  }
  return null
}

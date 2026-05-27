import { create } from 'zustand'
import {
  cancelLastUndoSnapshotIfEraseUnchanged,
  pushUndoSnapshot,
  redo as historyRedo,
  undo as historyUndo,
} from '../canvasHistory/canvasHistory'
import { playSound } from '../sound/playSound'
import { useCanvasLockStore } from '../canvasLock/canvasLockStore'
import { effectiveCanvasLocked } from '../canvasLock/layer'
import { ERASE_HIT_RADIUS, hitTestStroke } from './eraseUtils'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import {
  maxCommittedStrokeZ,
  nextCanvasStackZIndex,
} from '../canvasItems/canvasZOrder'
import { notifyWorkspacePersist, useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import { strokeToSvgPath, ensureMinimumStrokePoints } from './strokePath'
import { generateStrokeId } from './strokeId'
import type { DrawTool, Stroke, StrokePoint } from './types'

type StrokeConfig = {
  color: string
  size: number
  tool: DrawTool
}

type StrokesState = {
  strokes: Stroke[]
  annotationStrokes: Stroke[]
  activeStroke: Stroke | null
  startStroke: (point: StrokePoint, config: StrokeConfig) => void
  addPoint: (point: StrokePoint) => void
  endStroke: () => void
  cancelActiveStroke: () => void
  cancelEraseSession: () => void
  beginDragErase: () => void
  applyDragErase: (pos: { x: number; y: number }) => void
  undo: () => boolean
  redo: () => boolean
  hydrate: () => void
  moveStrokes: (ids: string[], dx: number, dy: number) => void
  deleteStrokes: (ids: string[], opts?: { skipSnapshot?: boolean }) => void
  recolorStrokes: (ids: string[], color: string) => void
  duplicateStrokes: (ids: string[]) => string[]
}

function createStroke(point: StrokePoint, config: StrokeConfig): Stroke {
  return {
    id: generateStrokeId(),
    points: [point],
    color: config.color,
    size: config.size,
    tool: config.tool,
  }
}

let persistEnabled = false

function persist(opts?: { immediate?: boolean }) {
  if (!persistEnabled) return
  if (opts?.immediate) {
    useCanvasWorkspaceStore.getState().flushPersistWorkspace()
    return
  }
  notifyWorkspacePersist()
}

export const useStrokesStore = create<StrokesState>((set, get) => ({
  strokes: [],
  annotationStrokes: [],
  activeStroke: null,

  hydrate: () => {
    persistEnabled = true
  },

  startStroke: (point, config) => {
    set({ activeStroke: createStroke(point, config) })
  },

  addPoint: (point) => {
    const { activeStroke } = get()
    if (!activeStroke) return
    set({
      activeStroke: {
        ...activeStroke,
        points: [...activeStroke.points, point],
      },
    })
  },

  cancelActiveStroke: () => {
    set({ activeStroke: null })
  },

  cancelEraseSession: () => {
    cancelLastUndoSnapshotIfEraseUnchanged()
  },

  endStroke: () => {
    const active = get().activeStroke
    if (!active) return

    let points = [...active.points]
    // Drop a single pen-hover tail point only — trimming a run of low-pressure
    // lift-off samples was shortening finished strokes vs the live preview.
    if (points.length > 2 && points[points.length - 1].pressure < 0.05) {
      points.pop()
    }

    if (points.length === 0) {
      set({ activeStroke: null })
      return
    }

    points = ensureMinimumStrokePoints(points, 3)

    pushUndoSnapshot()

    const trimmed: Stroke = { ...active, points }
    const path = strokeToSvgPath(trimmed, false)
    const completed = { ...trimmed, path }
    const isLocked = effectiveCanvasLocked(
      useCanvasLockStore.getState().isLocked,
    )

    if (isLocked) {
      const annotationStrokes = [...get().annotationStrokes, completed]
      set({ annotationStrokes, activeStroke: null })
      persist({ immediate: true })
      return
    }

    const items = useCanvasItemsStore.getState().items
    const existingStrokes = get().strokes
    const zIndex = nextCanvasStackZIndex(items, maxCommittedStrokeZ(existingStrokes))
    const strokes = [...existingStrokes, { ...completed, zIndex }]
    set({ strokes, activeStroke: null })
    persist({ immediate: true })
  },

  beginDragErase: () => {
    pushUndoSnapshot()
  },

  applyDragErase: (pos) => {
    const isLocked = effectiveCanvasLocked(
      useCanvasLockStore.getState().isLocked,
    )
    const { strokes, annotationStrokes } = get()

    if (isLocked) {
      const next = annotationStrokes.filter(
        (stroke) => !hitTestStroke(stroke, pos.x, pos.y, ERASE_HIT_RADIUS),
      )
      if (next.length === annotationStrokes.length) return
      set({ annotationStrokes: next })
      persist({ immediate: true })
      return
    }

    const next = strokes.filter(
      (stroke) => !hitTestStroke(stroke, pos.x, pos.y, ERASE_HIT_RADIUS),
    )
    if (next.length === strokes.length) return

    set({ strokes: next })
    persist({ immediate: true })
  },

  undo: () => {
    const changed = historyUndo()
    if (changed) playSound('undo')
    return changed
  },

  redo: () => {
    const changed = historyRedo()
    if (changed) playSound('redo')
    return changed
  },

  moveStrokes: (ids, dx, dy) => {
    const idSet = new Set(ids)
    set((s) => ({
      strokes: s.strokes.map((st) =>
        idSet.has(st.id)
          ? { ...st, path: undefined, points: st.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })) }
          : st,
      ),
    }))
    persist()
  },

  deleteStrokes: (ids, opts) => {
    if (!opts?.skipSnapshot) pushUndoSnapshot()
    const idSet = new Set(ids)
    set((s) => ({ strokes: s.strokes.filter((st) => !idSet.has(st.id)) }))
    persist()
  },

  recolorStrokes: (ids, color) => {
    pushUndoSnapshot()
    const idSet = new Set(ids)
    set((s) => ({
      strokes: s.strokes.map((st) =>
        idSet.has(st.id) ? { ...st, color, path: undefined } : st,
      ),
    }))
    persist()
  },

  duplicateStrokes: (ids) => {
    pushUndoSnapshot()
    const idSet = new Set(ids)
    const { strokes } = get()
    const OFFSET = 20
    const newStrokes: Stroke[] = []
    for (const st of strokes) {
      if (!idSet.has(st.id)) continue
      const newId = generateStrokeId()
      newStrokes.push({
        ...st,
        id: newId,
        path: undefined,
        points: st.points.map((p) => ({ ...p, x: p.x + OFFSET, y: p.y + OFFSET })),
      })
    }
    set((s) => ({ strokes: [...s.strokes, ...newStrokes] }))
    persist()
    return newStrokes.map((s) => s.id)
  },
}))

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
  undo: () => void
  redo: () => void
  hydrate: () => void
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
    while (points.length > 2 && points[points.length - 1].pressure < 0.15) {
      points.pop()
    }

    if (points.length === 0) {
      set({ activeStroke: null })
      return
    }

    points = ensureMinimumStrokePoints(points, 3)

    pushUndoSnapshot()

    const trimmed: Stroke = { ...active, points }
    const path = strokeToSvgPath(trimmed, true)
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

    const strokes = [...get().strokes, completed]
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
    if (historyUndo()) playSound('undo')
  },

  redo: () => {
    if (historyRedo()) playSound('redo')
  },
}))

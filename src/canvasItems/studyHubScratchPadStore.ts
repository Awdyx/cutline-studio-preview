import { create } from 'zustand'
import { playSound } from '../sound/playSound'
import type { Stroke } from '../drawing/types'
import { useCanvasItemsStore } from './canvasItemsStore'

const MAX_HISTORY = 50

function cloneStrokes(strokes: Stroke[]): Stroke[] {
  return strokes.map((s) => ({
    ...s,
    points: s.points.map((p) => ({ ...p })),
  }))
}

function strokesEqual(a: Stroke[], b: Stroke[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id) return false
  }
  return true
}

let past: Stroke[][] = []
let future: Stroke[][] = []
let eraseSession = false
let eraseStartStrokes: Stroke[] | null = null

function pushPast(strokes: Stroke[]) {
  past.push(cloneStrokes(strokes))
  if (past.length > MAX_HISTORY) past.shift()
  future = []
}

type StudyHubScratchPadState = {
  strokes: Stroke[]
  resetStrokes: () => void
  appendStroke: (stroke: Stroke) => void
  eraseStrokesAt: (hit: (stroke: Stroke) => boolean) => void
  deleteStrokes: (hit: (stroke: Stroke) => boolean) => void
  beginEraseSession: () => void
  endEraseSession: () => void
  undo: () => boolean
  redo: () => boolean
  canUndo: () => boolean
  canRedo: () => boolean
}

export const useStudyHubScratchPadStore = create<StudyHubScratchPadState>(
  (set, get) => ({
    strokes: [],

    resetStrokes: () => {
      past = []
      future = []
      eraseSession = false
      eraseStartStrokes = null
      set({ strokes: [] })
    },

    appendStroke: (stroke) => {
      const prev = get().strokes
      pushPast(prev)
      set({ strokes: [...prev, stroke] })
    },

    eraseStrokesAt: (hit) => {
      set((s) => {
        const next = s.strokes.filter((stroke) => !hit(stroke))
        return next.length === s.strokes.length ? s : { strokes: next }
      })
    },

    deleteStrokes: (hit) => {
      const prev = get().strokes
      const next = prev.filter((stroke) => !hit(stroke))
      if (next.length === prev.length) return
      pushPast(prev)
      set({ strokes: next })
    },

    beginEraseSession: () => {
      if (eraseSession) return
      eraseSession = true
      eraseStartStrokes = cloneStrokes(get().strokes)
      pushPast(get().strokes)
    },

    endEraseSession: () => {
      if (!eraseSession) return
      eraseSession = false
      if (
        eraseStartStrokes &&
        strokesEqual(eraseStartStrokes, get().strokes)
      ) {
        past.pop()
      }
      eraseStartStrokes = null
    },

    canUndo: () => past.length > 0,

    canRedo: () => future.length > 0,

    undo: () => {
      if (past.length === 0) return false
      future.unshift(cloneStrokes(get().strokes))
      const prev = past.pop()!
      set({ strokes: prev })
      playSound('undo')
      return true
    },

    redo: () => {
      if (future.length === 0) return false
      past.push(cloneStrokes(get().strokes))
      const next = future.shift()!
      set({ strokes: next })
      playSound('redo')
      return true
    },
  }),
)

export function studyHubScratchPadUndoScope(): boolean {
  return useCanvasItemsStore.getState().menuFocusScratchPadOpen
}

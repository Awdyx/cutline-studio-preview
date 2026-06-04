import { create } from 'zustand'
import { pushUndoSnapshot, clearHistory } from '../canvasHistory/canvasHistory'
import { playSound } from '../sound/playSound'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { useStrokesStore } from '../drawing/strokesStore'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import {
  clearLayerItems,
  effectiveCanvasLocked,
  hasAnyAnnotations,
  hasClearableLayerContent,
  mergeAnnotationsIntoCommitted,
} from './layer'
import {
  loadCanvasLockFromStorage,
  saveCanvasLockToStorage,
} from './canvasLockPersistence'

type CanvasLockState = {
  isLocked: boolean
  hydrate: () => void
  lockCanvas: () => void
  requestUnlock: () => void
  /**
   * Locked: removes annotation-layer items and strokes; committed content is untouched.
   * Unlocked: removes all drawable content (strokes, stickies, text); media and spaces remain.
   */
  clearAllAnnotations: () => void
}

let persistEnabled = false

function persistLock(isLocked: boolean) {
  if (persistEnabled) saveCanvasLockToStorage(isLocked)
}

export const useCanvasLockStore = create<CanvasLockState>((set, get) => {
  function finishUnlock() {
    set({ isLocked: false })
    persistLock(false)
    clearHistory()
    playSound('unlock')
  }

  function mergeAnnotationsAndUnlock() {
    const mergedItems = mergeAnnotationsIntoCommitted(
      useCanvasItemsStore.getState().items,
    )
    const strokesStore = useStrokesStore.getState()
    const mergedStrokes = [...strokesStore.strokes, ...strokesStore.annotationStrokes]

    useCanvasItemsStore.setState({
      items: mergedItems,
      activeStickyStroke: null,
      activeSpaceTitleStroke: null,
    })
    useStrokesStore.setState({
      strokes: mergedStrokes,
      annotationStrokes: [],
      activeStroke: null,
    })
    useCanvasWorkspaceStore.getState().flushPersistWorkspace()

    finishUnlock()
  }

  return {
  isLocked: false,

  hydrate: () => {
    const isLocked = loadCanvasLockFromStorage()
    set({ isLocked })
    persistEnabled = true
  },

  lockCanvas: () => {
    if (get().isLocked) return
    set({ isLocked: true })
    persistLock(true)
    clearHistory()
    playSound('lock')
  },

  requestUnlock: () => {
    if (!get().isLocked) return
    const items = useCanvasItemsStore.getState().items
    const annotationStrokes = useStrokesStore.getState().annotationStrokes
    if (!hasAnyAnnotations(items, annotationStrokes)) {
      finishUnlock()
      return
    }
    mergeAnnotationsAndUnlock()
  },

  clearAllAnnotations: () => {
    const isLocked = get().isLocked
    const items = useCanvasItemsStore.getState().items
    const { strokes, annotationStrokes } = useStrokesStore.getState()
    if (!hasClearableLayerContent(items, strokes, annotationStrokes, isLocked)) {
      return
    }

    pushUndoSnapshot()

    const lockActive = effectiveCanvasLocked(isLocked)
    const nextItems = clearLayerItems(items, isLocked)
    const nextStrokes = lockActive ? strokes : []
    const nextAnnotationStrokes: typeof annotationStrokes = []

    useCanvasItemsStore.setState({
      items: nextItems,
      activeStickyStroke: null,
      activeSpaceTitleStroke: null,
    })
    useStrokesStore.setState({
      strokes: nextStrokes,
      annotationStrokes: nextAnnotationStrokes,
      activeStroke: null,
    })
    useCanvasWorkspaceStore.getState().flushPersistWorkspace()
    playSound('wipeCanvas')
  },
  }
})

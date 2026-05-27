import { create } from 'zustand'
import { useStrokesStore } from './strokesStore'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import {
  screenPolyToCanvas,
  strokeIntersectsPolygon,
  itemIntersectsPolygon,
  type Pt,
} from './lassoGeometry'
import type { CanvasItemType } from '../canvasItems/types'

export type LassoTargetType = 'strokes' | CanvasItemType

const DEFAULT_TARGETS: LassoTargetType[] = ['strokes']

const LASSO_TARGETS_KEY = 'cutline-lasso-targets-v1'
const VALID_TARGETS = new Set<LassoTargetType>([
  'strokes', 'sticky', 'text', 'image', 'video', 'space', 'study_hub',
])

function loadTargetTypes(): LassoTargetType[] {
  try {
    const raw = localStorage.getItem(LASSO_TARGETS_KEY)
    if (!raw) return [...DEFAULT_TARGETS]
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return [...DEFAULT_TARGETS]
    const valid = parsed.filter((t): t is LassoTargetType => VALID_TARGETS.has(t as LassoTargetType))
    return valid.length > 0 ? valid : [...DEFAULT_TARGETS]
  } catch {
    return [...DEFAULT_TARGETS]
  }
}

function saveTargetTypes(types: LassoTargetType[]): void {
  try {
    localStorage.setItem(LASSO_TARGETS_KEY, JSON.stringify(types))
  } catch {
    // ignore
  }
}

type LassoState = {
  /** Screen-space points being drawn (for the SVG overlay). */
  drawingPoints: Pt[]
  isDrawing: boolean

  /** IDs committed after completing a lasso gesture. */
  selectedStrokeIds: string[]
  selectedItemIds: string[]

  /** Previous selection — restored on undo after deselect. */
  previousStrokeIds: string[]
  previousItemIds: string[]

  /**
   * Live drag offset in canvas coordinates.
   * Applied as an SVG <g transform> — zero path recomputation during drag.
   * Committed to actual stroke points on drag end.
   */
  dragOffset: { canvasDx: number; canvasDy: number; ids: string[] } | null

  /** What element types to include in lasso selection. */
  targetTypes: LassoTargetType[]

  startLasso: (x: number, y: number) => void
  addPoint: (x: number, y: number) => void
  commitLasso: (canvasEl: HTMLElement | null) => void
  cancelLasso: () => void
  clearSelection: () => void
  /** Restores previous selection. Returns true if there was something to restore. */
  undoClearSelection: () => boolean
  toggleTargetType: (type: LassoTargetType) => void
  setDragOffset: (offset: { canvasDx: number; canvasDy: number; ids: string[] } | null) => void
}

export const useLassoStore = create<LassoState>((set, get) => ({
  drawingPoints: [],
  isDrawing: false,
  selectedStrokeIds: [],
  selectedItemIds: [],
  previousStrokeIds: [],
  previousItemIds: [],
  dragOffset: null,
  targetTypes: loadTargetTypes(),

  startLasso: (x, y) => set({ drawingPoints: [{ x, y }], isDrawing: true }),

  addPoint: (x, y) =>
    set((s) => ({ drawingPoints: [...s.drawingPoints, { x, y }] })),

  commitLasso: (canvasEl) => {
    const { drawingPoints, targetTypes } = get()
    if (!canvasEl || drawingPoints.length < 3) {
      set({ drawingPoints: [], isDrawing: false })
      return
    }

    const canvasPoly = screenPolyToCanvas(drawingPoints, canvasEl)

    let strokeIds: string[] = []
    let itemIds: string[] = []

    if (targetTypes.includes('strokes')) {
      const { strokes } = useStrokesStore.getState()
      strokeIds = strokes
        .filter((s) => strokeIntersectsPolygon(s, canvasPoly))
        .map((s) => s.id)
    }

    const itemTargets = targetTypes.filter((t): t is CanvasItemType => t !== 'strokes')
    if (itemTargets.length > 0) {
      const { items } = useCanvasItemsStore.getState()
      itemIds = items
        .filter((item) => itemTargets.includes(item.type) && itemIntersectsPolygon(item, canvasPoly))
        .map((item) => item.id)
      // Sync to canvas items store so items visually appear selected
      useCanvasItemsStore.getState().setSelectedIds(itemIds)
    }

    set({
      drawingPoints: [],
      isDrawing: false,
      selectedStrokeIds: strokeIds,
      selectedItemIds: itemIds,
      previousStrokeIds: [],
      previousItemIds: [],
    })
  },

  cancelLasso: () => set({ drawingPoints: [], isDrawing: false }),

  clearSelection: () => {
    const { selectedStrokeIds, selectedItemIds } = get()
    set({
      selectedStrokeIds: [],
      selectedItemIds: [],
      previousStrokeIds: selectedStrokeIds,
      previousItemIds: selectedItemIds,
      dragOffset: null,
    })
    // Deselect canvas items if any were lasso-selected
    if (selectedItemIds.length > 0) {
      useCanvasItemsStore.getState().clearSelection({ silent: true })
    }
  },

  undoClearSelection: () => {
    const { previousStrokeIds, previousItemIds } = get()
    if (previousStrokeIds.length === 0 && previousItemIds.length === 0) return false
    set({
      selectedStrokeIds: previousStrokeIds,
      selectedItemIds: previousItemIds,
      previousStrokeIds: [],
      previousItemIds: [],
    })
    // Restore canvas item selection
    if (previousItemIds.length > 0) {
      useCanvasItemsStore.getState().setSelectedIds(previousItemIds)
    }
    return true
  },

  toggleTargetType: (type) =>
    set((s) => {
      const has = s.targetTypes.includes(type)
      if (has && s.targetTypes.length === 1) return s // keep at least one
      const next = has
        ? s.targetTypes.filter((t) => t !== type)
        : [...s.targetTypes, type]
      saveTargetTypes(next)
      return { targetTypes: next }
    }),

  setDragOffset: (offset) => set({ dragOffset: offset }),
}))

import { create } from 'zustand'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import {
  clampStudioCentrePosition,
  defaultStudioCentrePosition,
  syncStudioCentreCssVars,
  syncStudioCentreLayoutVars,
  type StudioCentrePosition,
} from './studioCentrePosition'

interface StudioCentrePositionState extends StudioCentrePosition {
  setPosition: (x: number, y: number, opts?: { persist?: boolean }) => void
  /** CSS vars + optional transform only — skips Zustand (use while dragging). */
  setVisualPosition: (x: number, y: number) => void
  hydrate: (pos: StudioCentrePosition | null | undefined) => void
}

export const useStudioCentrePositionStore = create<StudioCentrePositionState>(
  (set, get) => ({
    ...defaultStudioCentrePosition(),

    setVisualPosition: (x, y) => {
      const clamped = clampStudioCentrePosition(x, y)
      syncStudioCentreLayoutVars(clamped.x, clamped.y)
    },

    setPosition: (x, y, opts) => {
      const clamped = clampStudioCentrePosition(x, y)
      const prev = get()
      if (clamped.x === prev.x && clamped.y === prev.y) {
        syncStudioCentreCssVars(clamped.x, clamped.y)
        return
      }
      set(clamped)
      syncStudioCentreCssVars(clamped.x, clamped.y)
      if (opts?.persist !== false) {
        useCanvasWorkspaceStore.getState().persistWorkspace()
      }
    },

    hydrate: (pos) => {
      const next = pos
        ? clampStudioCentrePosition(pos.x, pos.y)
        : defaultStudioCentrePosition()
      set(next)
      syncStudioCentreCssVars(next.x, next.y)
    },
  }),
)

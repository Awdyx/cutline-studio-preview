import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { create } from 'zustand'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import {
  clampStudioCentrePosition,
  defaultStudioCentrePosition,
  resolveStudioCentrePosition,
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

export function registerStudioCentreTransformRef(
  _ref: RefObject<ReactZoomPanPinchContentRef | null> | null,
): void {
  // Reserved for future camera compensation when the studio centre moves.
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
      const next = resolveStudioCentrePosition(pos)
      set(next)
      syncStudioCentreCssVars(next.x, next.y)
    },
  }),
)

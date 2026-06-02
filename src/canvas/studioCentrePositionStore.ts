import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { create } from 'zustand'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import { compensateCameraForStudioMove } from './canvasCamera'
import {
  clampStudioCentrePosition,
  defaultStudioCentrePosition,
  syncStudioCentreCssVars,
  syncStudioCentreLayoutVars,
  type StudioCentrePosition,
} from './studioCentrePosition'
import { registerOverviewHyperTransformRef } from './canvasVirtualPan'

interface StudioCentrePositionState extends StudioCentrePosition {
  setPosition: (x: number, y: number, opts?: { persist?: boolean }) => void
  /** CSS vars + optional transform only — skips Zustand (use while dragging). */
  setVisualPosition: (x: number, y: number) => void
  hydrate: (pos: StudioCentrePosition | null | undefined) => void
}

let transformRefForStudioCompensation: RefObject<ReactZoomPanPinchContentRef | null> | null =
  null

export function registerStudioCentreTransformRef(
  ref: RefObject<ReactZoomPanPinchContentRef | null> | null,
): void {
  transformRefForStudioCompensation = ref
  registerOverviewHyperTransformRef(ref)
}

export const useStudioCentrePositionStore = create<StudioCentrePositionState>(
  (set, get) => ({
    ...defaultStudioCentrePosition(),

    setVisualPosition: (x, y) => {
      const prev = get()
      const clamped = clampStudioCentrePosition(x, y)
      syncStudioCentreLayoutVars(clamped.x, clamped.y)
      compensateCameraForStudioMove(
        transformRefForStudioCompensation?.current ?? null,
        prev.x,
        prev.y,
        clamped.x,
        clamped.y,
      )
    },

    setPosition: (x, y, opts) => {
      const clamped = clampStudioCentrePosition(x, y)
      const prev = get()
      if (clamped.x === prev.x && clamped.y === prev.y) {
        syncStudioCentreCssVars(clamped.x, clamped.y)
        return
      }
      compensateCameraForStudioMove(
        transformRefForStudioCompensation?.current ?? null,
        prev.x,
        prev.y,
        clamped.x,
        clamped.y,
      )
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

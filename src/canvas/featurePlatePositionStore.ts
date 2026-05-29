import { create } from 'zustand'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import {
  defaultFeaturePlatePositions,
  syncAllFeaturePlateLayoutVars,
  syncFeaturePlateLayoutVars,
  type FeaturePlateDestination,
} from './canvasPlate'
import {
  clampFeaturePlatePosition,
  type StudioCentrePosition,
} from './studioCentrePosition'

export type FeaturePlatePositions = Record<
  FeaturePlateDestination,
  StudioCentrePosition
>

type FeaturePlatePositionState = {
  positions: FeaturePlatePositions
  setPosition: (
    dest: FeaturePlateDestination,
    x: number,
    y: number,
    opts?: { persist?: boolean },
  ) => void
  setVisualPosition: (dest: FeaturePlateDestination, x: number, y: number) => void
  hydrate: (raw: Partial<FeaturePlatePositions> | null | undefined) => void
}

export function normalizeFeaturePlatePositions(
  raw: Partial<FeaturePlatePositions> | null | undefined,
): FeaturePlatePositions {
  const defaults = defaultFeaturePlatePositions()
  if (!raw || typeof raw !== 'object') return defaults

  const next = { ...defaults }
  for (const dest of Object.keys(defaults) as FeaturePlateDestination[]) {
    const entry = raw[dest]
    if (
      entry &&
      typeof entry.x === 'number' &&
      typeof entry.y === 'number' &&
      Number.isFinite(entry.x) &&
      Number.isFinite(entry.y)
    ) {
      next[dest] = clampFeaturePlatePosition(entry.x, entry.y)
    }
  }
  return next
}

export const useFeaturePlatePositionStore = create<FeaturePlatePositionState>(
  (set, get) => ({
    positions: defaultFeaturePlatePositions(),

    setVisualPosition: (dest, x, y) => {
      const clamped = clampFeaturePlatePosition(x, y)
      syncFeaturePlateLayoutVars(dest, clamped.x, clamped.y)
    },

    setPosition: (dest, x, y, opts) => {
      const clamped = clampFeaturePlatePosition(x, y)
      const prev = get().positions[dest]
      if (clamped.x === prev.x && clamped.y === prev.y) {
        syncFeaturePlateLayoutVars(dest, clamped.x, clamped.y)
        return
      }
      set((state) => ({
        positions: { ...state.positions, [dest]: clamped },
      }))
      syncFeaturePlateLayoutVars(dest, clamped.x, clamped.y)
      if (opts?.persist !== false) {
        useCanvasWorkspaceStore.getState().persistWorkspace()
      }
    },

    hydrate: (raw) => {
      const next = normalizeFeaturePlatePositions(raw)
      set({ positions: next })
      syncAllFeaturePlateLayoutVars(next)
    },
  }),
)

import { create } from 'zustand'
import {
  DEFAULT_FEATURE_PLATE_DIMENSIONS,
  featurePlateDimensionsForViewport,
  type FeaturePlateDimensions,
} from './featurePlateViewportDimensions'

type FeaturePlateViewportState = {
  dimensions: FeaturePlateDimensions
  syncFromViewport: (viewportWidth: number, viewportHeight: number) => boolean
}

export function getFeaturePlateDimensions(): FeaturePlateDimensions {
  return useFeaturePlateViewportStore.getState().dimensions
}

export const useFeaturePlateViewportStore = create<FeaturePlateViewportState>(
  (set, get) => ({
    dimensions: DEFAULT_FEATURE_PLATE_DIMENSIONS,
    syncFromViewport: (viewportWidth, viewportHeight) => {
      const prev = get().dimensions
      const next = featurePlateDimensionsForViewport(
        viewportWidth,
        viewportHeight,
        prev,
      )
      if (!next) return false
      set({ dimensions: next })
      return true
    },
  }),
)

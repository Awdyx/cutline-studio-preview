import { useEffect } from 'react'
import { syncAllFeaturePlateLayoutVars } from './canvasPlate'
import { useFeaturePlatePositionStore } from './featurePlatePositionStore'

/** One-time sync of feature-plate CSS vars on mount. */
export function useFeaturePlatePositionCssVars() {
  useEffect(() => {
    syncAllFeaturePlateLayoutVars(
      useFeaturePlatePositionStore.getState().positions,
    )
  }, [])
}

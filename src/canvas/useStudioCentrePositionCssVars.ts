import { useEffect } from 'react'
import { useStudioCentrePositionStore } from './studioCentrePositionStore'
import { syncStudioCentreCssVars } from './studioCentrePosition'

/** One-time sync of studio-centre CSS vars on mount (drag updates vars directly). */
export function useStudioCentrePositionCssVars() {
  useEffect(() => {
    const { x, y } = useStudioCentrePositionStore.getState()
    syncStudioCentreCssVars(x, y)
  }, [])
}

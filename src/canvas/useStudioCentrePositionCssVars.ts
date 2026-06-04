import { useEffect } from 'react'
import {
  centredStudioCentrePosition,
  syncStudioCentreCssVars,
} from './studioCentrePosition'
import { useStudioCentrePositionStore } from './studioCentrePositionStore'

/** Sync void-centred studio layout vars on mount (before async workspace hydrate). */
export function useStudioCentrePositionCssVars() {
  useEffect(() => {
    const next = centredStudioCentrePosition()
    useStudioCentrePositionStore.setState(next)
    syncStudioCentreCssVars(next.x, next.y)
  }, [])
}

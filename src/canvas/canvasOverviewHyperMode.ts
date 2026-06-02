import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { readCameraFromRef } from './canvasCamera'
import { useCanvasOverviewStore } from './canvasOverviewStore'

/** Swap to the studio-sized compositor layer while preserving the on-screen view. */
export function enableOverviewHyperMode(
  ref: ReactZoomPanPinchContentRef,
  onReady?: () => void,
): void {
  const virtual = readCameraFromRef(ref)
  const store = useCanvasOverviewStore.getState()

  if (virtual) {
    store.commitHyperLayoutHandoff(true, {
      mode: 'enter',
      virtual,
      onComplete: onReady,
    })
    return
  }

  store.setHyperOptimized(true)
  onReady?.()
}

/** Restore the full void transform tree after overview. */
export function disableOverviewHyperMode(
  ref: ReactZoomPanPinchContentRef,
  onReady?: () => void,
): void {
  const { positionX, positionY, scale } = ref.state
  const store = useCanvasOverviewStore.getState()

  if (
    Number.isFinite(positionX) &&
    Number.isFinite(positionY) &&
    Number.isFinite(scale) &&
    scale > 0
  ) {
    store.commitHyperLayoutHandoff(false, {
      mode: 'exit',
      library: { positionX, positionY, scale },
      onComplete: onReady,
    })
    return
  }

  store.setHyperOptimized(false)
  onReady?.()
}

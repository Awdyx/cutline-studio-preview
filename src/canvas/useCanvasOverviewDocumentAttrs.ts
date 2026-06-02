import { useLayoutEffect } from 'react'
import { useCanvasOverviewStore } from './canvasOverviewStore'
import { assertOverviewHyperHealth } from './overviewHyperHealthCheck'

/** Sync overview / fisheye document attrs for CSS and compositor paths (before paint). */
export function useCanvasOverviewDocumentAttrs() {
  const engaged = useCanvasOverviewStore((s) => s.engaged)
  const transitioning = useCanvasOverviewStore((s) => s.transitioning)
  const hyperOptimized = useCanvasOverviewStore((s) => s.hyperOptimized)
  const plateCompositorActive = useCanvasOverviewStore(
    (s) => s.hyperOptimized || s.layoutHandoff?.mode === 'exit',
  )

  useLayoutEffect(() => {
    const root = document.documentElement

    if (engaged) {
      root.setAttribute('data-fisheye-engaged', '')
    } else {
      root.removeAttribute('data-fisheye-engaged')
    }

    if (transitioning) {
      root.setAttribute('data-canvas-overview-transitioning', '')
    } else {
      root.removeAttribute('data-canvas-overview-transitioning')
    }

    if (plateCompositorActive) {
      root.setAttribute('data-canvas-overview-hyper', '')
    } else {
      root.removeAttribute('data-canvas-overview-hyper')
    }

    if (engaged && !transitioning && hyperOptimized) {
      assertOverviewHyperHealth()
    }
  }, [engaged, transitioning, plateCompositorActive, hyperOptimized])
}

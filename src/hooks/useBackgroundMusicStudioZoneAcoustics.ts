import { useEffect, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { useCanvasFisheyeStore } from '../canvas/canvasFisheyeStore'
import { useStudioCentrePositionStore } from '../canvas/studioCentrePositionStore'
import { useFeaturePlatePositionStore } from '../canvas/featurePlatePositionStore'
import { viewportCenterFullCanvas } from '../canvasItems/viewportCenter'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import { syncBackgroundMusicAcoustics } from '../sound/backgroundMusicAcoustics'
import { syncCanvasPlateViewportZone } from '../canvas/canvasPlateViewportZone'

/** Keep ambient music acoustics in sync with viewport distance from the studio canvas. */
export function useBackgroundMusicStudioZoneAcoustics(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  viewportRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    let raf = 0

    const sync = () => {
      syncCanvasPlateViewportZone(transformRef, viewportRef)
      const center = viewportCenterFullCanvas(transformRef, viewportRef.current)
      syncBackgroundMusicAcoustics({ viewportCenter: center })
    }

    const tick = () => {
      sync()
      raf = requestAnimationFrame(tick)
    }

    sync()
    raf = requestAnimationFrame(tick)

    const unsubStudio = useStudioCentrePositionStore.subscribe(sync)
    const unsubPlates = useFeaturePlatePositionStore.subscribe(sync)
    const unsubFisheye = useCanvasFisheyeStore.subscribe(sync)
    const unsubWorkspace = useCanvasWorkspaceStore.subscribe(sync)

    return () => {
      cancelAnimationFrame(raf)
      unsubStudio()
      unsubPlates()
      unsubFisheye()
      unsubWorkspace()
    }
  }, [transformRef, viewportRef])
}

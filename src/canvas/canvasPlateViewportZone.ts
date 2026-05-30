import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { viewportCenterFullCanvas } from '../canvasItems/viewportCenter'
import { isCameraFlyActive } from '../panMotionStore'
import { useAppDestinationStore } from '../navigation/appDestinationStore'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import { resolveCanvasPlateAt } from './canvasPlate'
import { useCanvasStudioViewportZoneStore } from './canvasStudioViewportZoneStore'

/** Track viewport-centre proximity to any main-canvas plate and sync active destination. */
export function syncCanvasPlateViewportZone(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  viewportRef: RefObject<HTMLElement | null>,
): void {
  const { setViewportZone } = useCanvasStudioViewportZoneStore.getState()

  if (isCameraFlyActive()) return

  if (useCanvasWorkspaceStore.getState().isInsideSpace()) {
    setViewportZone(true, 'studio')
    return
  }

  const center = viewportCenterFullCanvas(transformRef, viewportRef.current)
  if (!center) return

  const hit = resolveCanvasPlateAt(center.x, center.y)
  setViewportZone(hit != null, hit?.destination ?? null)

  if (hit) {
    const current = useAppDestinationStore.getState().destination
    if (current !== hit.destination) {
      useAppDestinationStore.getState().setDestination(hit.destination)
    }
  }
}

/** @deprecated Use syncCanvasPlateViewportZone */
export function syncStudioCanvasViewportZone(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  viewportRef: RefObject<HTMLElement | null>,
): void {
  syncCanvasPlateViewportZone(transformRef, viewportRef)
}

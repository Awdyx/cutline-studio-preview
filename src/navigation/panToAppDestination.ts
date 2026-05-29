import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  canvasMinimapFeaturePlateRect,
  canvasMinimapStudioRect,
} from '../canvas/canvasMinimapGeometry'
import { isFeaturePlateDestination } from '../canvas/canvasPlate'
import { panCanvasMinimapToItem } from '../canvas/canvasMinimapPanToItem'
import type { AppDestination } from './appDestinationStore'

/** Pan the main canvas viewport to centre on an app destination plate. */
export function panToAppDestination(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  destination: AppDestination,
): void {
  const rect =
    destination === 'studio'
      ? canvasMinimapStudioRect()
      : isFeaturePlateDestination(destination)
        ? canvasMinimapFeaturePlateRect(destination)
        : null
  if (!rect) return
  panCanvasMinimapToItem(transformRef, rect)
}

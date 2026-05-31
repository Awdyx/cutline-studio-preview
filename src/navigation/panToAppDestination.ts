import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { canvasMinimapStudioRect } from '../canvas/canvasMinimapGeometry'
import { panCanvasMinimapToItem } from '../canvas/canvasMinimapPanToItem'
import type { AppDestination } from './appDestinationStore'

/** Pan the main canvas viewport to centre on an app destination plate. */
export function panToAppDestination(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  destination: AppDestination,
): void {
  if (destination !== 'studio') return
  panCanvasMinimapToItem(transformRef, canvasMinimapStudioRect())
}

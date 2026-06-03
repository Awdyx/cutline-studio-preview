import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { studioCentreRect } from '../canvas/studioCentreRect'
import { panToCanvasRect } from '../canvas/panToCanvasRect'
import type { AppDestination } from './appDestinationStore'

/** Pan the main canvas viewport to centre on an app destination plate. */
export function panToAppDestination(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  destination: AppDestination,
): void {
  if (destination !== 'studio') return
  panToCanvasRect(transformRef, studioCentreRect())
}

import {
  CANVAS_ORIGINAL_HEIGHT,
  CANVAS_ORIGINAL_WIDTH,
} from '../drawing/canvasDimensions'
import { useStudioCentrePositionStore } from './studioCentrePositionStore'

export type CanvasPlateRect = {
  x: number
  y: number
  width: number
  height: number
}

/** Studio centre on the full canvas — reads live position from store. */
export function studioCentreRect(): CanvasPlateRect {
  const { x, y } = useStudioCentrePositionStore.getState()
  return {
    x,
    y,
    width: CANVAS_ORIGINAL_WIDTH,
    height: CANVAS_ORIGINAL_HEIGHT,
  }
}

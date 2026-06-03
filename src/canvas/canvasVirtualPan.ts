import {
  CANVAS_VIRTUAL_HEIGHT,
  CANVAS_VIRTUAL_WIDTH,
} from '../drawing/canvasDimensions'
import type { SpaceCamera } from '../spaces/types'

/** Map persisted virtual camera → library transform. */
export function libraryCameraFromVirtual(virtual: SpaceCamera): SpaceCamera {
  return virtual
}

/** Map library transform → virtual void camera for persistence and bounds. */
export function virtualCameraFromLibrary(library: SpaceCamera): SpaceCamera {
  return library
}

export function virtualPanContentSize(): { width: number; height: number } {
  return {
    width: CANVAS_VIRTUAL_WIDTH,
    height: CANVAS_VIRTUAL_HEIGHT,
  }
}

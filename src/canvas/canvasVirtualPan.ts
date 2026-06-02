import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  CANVAS_VIRTUAL_HEIGHT,
  CANVAS_VIRTUAL_WIDTH,
  canvasDomHeight,
  canvasDomWidth,
} from '../drawing/canvasDimensions'
import { useStudioCentrePositionStore } from './studioCentrePositionStore'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import { useCanvasOverviewStore } from './canvasOverviewStore'
import type { SpaceCamera } from '../spaces/types'

let transformRefForStudioCompensation: RefObject<ReactZoomPanPinchContentRef | null> | null =
  null

/** Plate-sized compositor — overview hyper path and exit handoff before DOM expands. */
export function isPlateCompositorActive(): boolean {
  if (useCanvasWorkspaceStore.getState().isInsideSpace()) return false
  const { hyperOptimized, layoutHandoff } = useCanvasOverviewStore.getState()
  return hyperOptimized || layoutHandoff?.mode === 'exit'
}

/** Overview hyper mode — virtual void pan with a studio-sized composited layer. */
export function isOverviewHyperPanActive(): boolean {
  return isPlateCompositorActive()
}

export function registerOverviewHyperTransformRef(
  ref: RefObject<ReactZoomPanPinchContentRef | null> | null,
): void {
  transformRefForStudioCompensation = ref
}

function studioVirtualOffset(): { x: number; y: number } {
  const { x, y } = useStudioCentrePositionStore.getState()
  return { x, y }
}

/** Map persisted / minimap virtual camera → library transform on the small DOM layer. */
export function libraryCameraFromVirtual(virtual: SpaceCamera): SpaceCamera {
  if (!isOverviewHyperPanActive()) return virtual
  const { x: sx, y: sy } = studioVirtualOffset()
  return {
    positionX: virtual.positionX + sx * virtual.scale,
    positionY: virtual.positionY + sy * virtual.scale,
    scale: virtual.scale,
  }
}

/** Map library transform → virtual void camera for persistence and bounds. */
export function virtualCameraFromLibrary(library: SpaceCamera): SpaceCamera {
  if (!isOverviewHyperPanActive()) return library
  const { x: sx, y: sy } = studioVirtualOffset()
  return {
    positionX: library.positionX - sx * library.scale,
    positionY: library.positionY - sy * library.scale,
    scale: library.scale,
  }
}

export function virtualPanContentSize(): { width: number; height: number } {
  return {
    width: CANVAS_VIRTUAL_WIDTH,
    height: CANVAS_VIRTUAL_HEIGHT,
  }
}

export function domPanContentSize(): { width: number; height: number } {
  return {
    width: canvasDomWidth(),
    height: canvasDomHeight(),
  }
}

/** Library bound props so pan/zoom uses virtual 7000×4000 limits on the small DOM layer. */
export function hyperPanLibraryBoundProps(
  viewportWidth: number,
  viewportHeight: number,
  studioX: number,
  studioY: number,
): {
  minPositionX: number
  maxPositionX: number
  minPositionY: number
  maxPositionY: number
} {
  return {
    minPositionX: viewportWidth - CANVAS_VIRTUAL_WIDTH + studioX,
    maxPositionX: studioX,
    minPositionY: viewportHeight - CANVAS_VIRTUAL_HEIGHT + studioY,
    maxPositionY: studioY,
  }
}

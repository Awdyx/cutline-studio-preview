import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { updateCanvasBarrelAfterCamera } from './canvasBarrelPostProcess'
import { focusItemOnCanvas, type FocusItemRect } from './canvasCamera'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'

const MINIMAP_PAN_MS = 720

type PanOptions = {
  onComplete?: () => void
}

/** Pan the fisheye viewport to centre on a canvas item while the map is open. */
export function panCanvasMinimapToItem(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  item: FocusItemRect,
  options?: PanOptions,
): void {
  const ref = transformRef.current
  if (!ref) return

  focusItemOnCanvas(ref, item, {
    mainCanvasPlate: true,
    animationMs: MINIMAP_PAN_MS,
    curved: true,
    onComplete: () => {
      if (transformRef.current !== ref) {
        options?.onComplete?.()
        return
      }
      useCanvasWorkspaceStore.getState().syncMainCamera(ref)
      updateCanvasBarrelAfterCamera(ref, { silent: true })
      options?.onComplete?.()
    },
  })
}

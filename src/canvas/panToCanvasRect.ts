import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { focusItemOnCanvas, type FocusItemRect } from './canvasCamera'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'

const PAN_MS = 520

type PanOptions = {
  onComplete?: () => void
}

/** Pan the main canvas viewport to centre on a canvas rect. */
export function panToCanvasRect(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  item: FocusItemRect,
  options?: PanOptions,
): void {
  const ref = transformRef.current
  if (!ref) return

  focusItemOnCanvas(ref, item, {
    mainCanvasPlate: true,
    animationMs: PAN_MS,
    curved: true,
    onComplete: () => {
      if (transformRef.current !== ref) {
        options?.onComplete?.()
        return
      }
      useCanvasWorkspaceStore.getState().syncMainCamera(ref)
      options?.onComplete?.()
    },
  })
}

import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { writeLibraryCameraTransform } from './canvasCamera'
import { useCanvasOverviewStore } from './canvasOverviewStore'
import { libraryCameraFromVirtual } from './canvasVirtualPan'
import type { SpaceCamera } from '../spaces/types'

function completeEnterHandoff(
  ref: ReactZoomPanPinchContentRef,
  virtual: SpaceCamera,
): void {
  const library = libraryCameraFromVirtual(virtual)
  writeLibraryCameraTransform(
    ref,
    library.positionX,
    library.positionY,
    library.scale,
    0,
  )
  ref.instance.update(ref.instance.props)
}

/** Apply a pending enter handoff synchronously (avoids plate camera drift on fast exit). */
export function flushPendingOverviewEnterHandoff(
  ref: ReactZoomPanPinchContentRef,
): void {
  const handoff = useCanvasOverviewStore.getState().layoutHandoff
  if (handoff?.mode !== 'enter') return
  completeEnterHandoff(ref, handoff.virtual)
  useCanvasOverviewStore.getState().setLayoutHandoff(null)
}

/** Drop a pending exit expand handoff when reversing back into overview. */
export function cancelPendingOverviewExitHandoff(): void {
  const store = useCanvasOverviewStore.getState()
  if (store.layoutHandoff?.mode !== 'exit') return
  store.setLayoutHandoff(null)
}

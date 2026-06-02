import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { onStudioCentreDragPointerDown } from './studioCentreDrag'
import { useStudioCentreDragStore } from './studioCentreDragStore'
import StudioPlateDragHandle from './StudioPlateDragHandle'

/** Fisheye overview — large grip + hit target (map mode keeps item-handle sizing). */
const OVERVIEW_STUDIO_DRAG_GRIP_SIZE = 58
const OVERVIEW_STUDIO_DRAG_HIT_SIZE = 168
const OVERVIEW_STUDIO_DRAG_OFFSET_Y = 12

type Props = {
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
}

/** Overview drag handle at the top-left of the studio centre. */
export default function StudioCentreDragHandle({ transformRef }: Props) {
  const minimapDragging = useStudioCentreDragStore((s) => s.minimapDragging)
  const chromeVisible = !minimapDragging

  return (
    <StudioPlateDragHandle
      ariaLabel="Move studio canvas"
      concealed={!chromeVisible}
      gripSize={OVERVIEW_STUDIO_DRAG_GRIP_SIZE}
      hitSize={OVERVIEW_STUDIO_DRAG_HIT_SIZE}
      offsetY={OVERVIEW_STUDIO_DRAG_OFFSET_Y}
      onPointerDown={(event) => {
        useStudioCentreDragStore.getState().setPanSuppressed(true)
        onStudioCentreDragPointerDown(transformRef, event, {
          dragThresholdPx: 0,
          commitImmediately: true,
        })
      }}
    />
  )
}

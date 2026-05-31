import { Grip } from 'lucide-react'
import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { useCanvasOverviewStore } from './canvasOverviewStore'
import { onStudioCentreDragPointerDown } from './studioCentreDrag'
import { useStudioCentreDragStore } from './studioCentreDragStore'

const STUDIO_HANDLE_HIT = 154
const STUDIO_HANDLE_VISUAL = 48
const STUDIO_HANDLE_GAP = 10
const STUDIO_HANDLE_OUTSET = (STUDIO_HANDLE_HIT - STUDIO_HANDLE_VISUAL) / 2

type Props = {
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
}

/** Overview-only drag handle at the top-left of the studio centre. */
export default function StudioCentreDragHandle({ transformRef }: Props) {
  const engaged = useCanvasOverviewStore((s) => s.engaged)
  const minimapDragging = useStudioCentreDragStore((s) => s.minimapDragging)
  const chromeVisible = !minimapDragging

  if (!engaged) return null

  return (
    <div
      className="studio-centre-drag-handle-wrapper"
      style={{
        position: 'absolute',
        left: -(STUDIO_HANDLE_VISUAL + STUDIO_HANDLE_GAP + STUDIO_HANDLE_OUTSET),
        top: STUDIO_HANDLE_OUTSET * -1,
        width: STUDIO_HANDLE_HIT,
        height: STUDIO_HANDLE_HIT,
        zIndex: 7000,
        opacity: chromeVisible ? 1 : 0,
        pointerEvents: chromeVisible ? 'auto' : 'none',
      }}
    >
      <button
        type="button"
        aria-label="Move studio canvas"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          useStudioCentreDragStore.getState().setPanSuppressed(true)
          onStudioCentreDragPointerDown(transformRef, e, {
            dragThresholdPx: 0,
            commitImmediately: true,
          })
        }}
        className="studio-centre-drag-handle"
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          border: 'none',
          borderRadius: 0,
          background: 'transparent',
          color: 'var(--canvas-handle-color)',
          cursor: 'grab',
          touchAction: 'none',
        }}
      >
        <Grip size={STUDIO_HANDLE_VISUAL} strokeWidth={1.5} />
      </button>
    </div>
  )
}

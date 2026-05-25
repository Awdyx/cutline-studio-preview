import { useRef } from 'react'
import { useCanvasHandleOccluded } from './canvasHandleOcclusion'
import {
  HANDLE_HIT_SIZE,
  HANDLE_VISUAL_SIZE,
  RESIZE_CORNER_OUTSET,
} from './grabZone'
import ResizeCornerBracket from './ResizeCornerBracket'

export default function ResizeHandle({
  onPointerDown,
  cornerOutset = RESIZE_CORNER_OUTSET,
  occlusionRevisionKey = '',
  occlusionActive = true,
}: {
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void
  cornerOutset?: number
  occlusionRevisionKey?: string
  occlusionActive?: boolean
}) {
  const hitOutset = (HANDLE_HIT_SIZE - HANDLE_VISUAL_SIZE) / 2
  const handleRef = useRef<HTMLButtonElement>(null)
  const occluded = useCanvasHandleOccluded(
    handleRef,
    occlusionActive,
    occlusionRevisionKey,
  )

  return (
    <button
      ref={handleRef}
      type="button"
      aria-label="Resize item"
      aria-disabled={occluded || undefined}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onPointerDown={onPointerDown}
      style={{
        position: 'absolute',
        left: '100%',
        top: '100%',
        marginLeft: cornerOutset,
        marginTop: cornerOutset,
        width: HANDLE_HIT_SIZE,
        height: HANDLE_HIT_SIZE,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        paddingTop: 0,
        paddingLeft: 0,
        paddingRight: hitOutset,
        paddingBottom: hitOutset,
        border: 'none',
        borderRadius: 0,
        background: 'transparent',
        color: 'var(--canvas-handle-color)',
        cursor: 'nwse-resize',
        touchAction: 'none',
        pointerEvents: 'auto',
        opacity: 'var(--canvas-resize-handle-opacity)',
        zIndex: 3,
      }}
      className={[
        'canvas-item-resize-handle',
        occluded ? 'canvas-item-handle-occluded' : null,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <ResizeCornerBracket />
    </button>
  )
}

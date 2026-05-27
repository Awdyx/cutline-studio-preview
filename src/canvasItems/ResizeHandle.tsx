import { useRef } from 'react'
import { useCanvasHandleOccluded } from './canvasHandleOcclusion'
import {
  HANDLE_VISUAL_SIZE,
  RESIZE_CORNER_OUTSET,
  resolveCanvasHandleHitSize,
} from './grabZone'
import ResizeCornerBracket from './ResizeCornerBracket'

export default function ResizeHandle({
  onPointerDown,
  cornerOutset = RESIZE_CORNER_OUTSET,
  occlusionRevisionKey = '',
  occlusionActive = true,
  hitSize = resolveCanvasHandleHitSize(),
}: {
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void
  cornerOutset?: number
  occlusionRevisionKey?: string
  occlusionActive?: boolean
  /** Override the invisible tap/drag target size (layout-aware default). */
  hitSize?: number
}) {
  const hitOutset = (hitSize - HANDLE_VISUAL_SIZE) / 2
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
        marginLeft: cornerOutset - hitOutset,
        marginTop: cornerOutset - hitOutset,
        width: hitSize,
        height: hitSize,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        paddingTop: hitOutset,
        paddingLeft: hitOutset,
        paddingRight: 0,
        paddingBottom: 0,
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

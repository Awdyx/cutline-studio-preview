import {
  HANDLE_HIT_SIZE,
  HANDLE_VISUAL_SIZE,
  RESIZE_CORNER_OUTSET,
} from './grabZone'
import ResizeCornerBracket from './ResizeCornerBracket'

export default function ResizeHandle({
  onPointerDown,
}: {
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void
}) {
  const hitOutset = (HANDLE_HIT_SIZE - HANDLE_VISUAL_SIZE) / 2

  return (
    <button
      type="button"
      aria-label="Resize item"
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onPointerDown={onPointerDown}
      style={{
        position: 'absolute',
        left: '100%',
        top: '100%',
        marginLeft: RESIZE_CORNER_OUTSET,
        marginTop: RESIZE_CORNER_OUTSET,
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
        transition: 'opacity 150ms ease, color 150ms ease',
        zIndex: 3,
      }}
      className="canvas-item-resize-handle"
    >
      <ResizeCornerBracket />
    </button>
  )
}

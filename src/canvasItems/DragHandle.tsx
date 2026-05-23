import { Grip } from 'lucide-react'
import {
  GRAB_HANDLE_OFFSET_X,
  GRAB_HANDLE_TOP,
  HANDLE_HIT_SIZE,
  HANDLE_VISUAL_SIZE,
} from './grabZone'

export default function DragHandle({
  onPointerDown,
}: {
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void
}) {
  const hitOutset = (HANDLE_HIT_SIZE - HANDLE_VISUAL_SIZE) / 2

  return (
    <button
      type="button"
      aria-label="Move or arrange canvas item"
      aria-haspopup="menu"
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onPointerDown={onPointerDown}
      style={{
        position: 'absolute',
        top: GRAB_HANDLE_TOP - hitOutset,
        left: -(GRAB_HANDLE_OFFSET_X + hitOutset),
        width: HANDLE_HIT_SIZE,
        height: HANDLE_HIT_SIZE,
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
        pointerEvents: 'auto',
        opacity: 'var(--canvas-handle-opacity)',
        transition: 'opacity 150ms ease, color 150ms ease',
        zIndex: 3,
      }}
      className="canvas-item-drag-handle"
    >
      <Grip size={13} strokeWidth={2} />
    </button>
  )
}

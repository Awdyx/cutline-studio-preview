import type { PointerEvent } from 'react'
import DragGripIcon from '../canvasItems/DragGripIcon'
import {
  DRAG_GRIP_VISUAL_SIZE,
  GRAB_HANDLE_GAP,
  GRAB_HANDLE_TOP,
  grabHandleHorizontalStyle,
  grabHandleVerticalStyle,
  resolveCanvasHandleHitSize,
  type GrabHandleSide,
  type GrabHandleVertical,
} from '../canvasItems/grabZone'

const PLACEMENT: { side: GrabHandleSide; vertical: GrabHandleVertical } = {
  side: 'left',
  vertical: 'top',
}

type Props = {
  ariaLabel: string
  concealed?: boolean
  hitSize?: number
  /** Visual grip size — when larger than item handles, offsets are recomputed. */
  gripSize?: number
  /** Extra downward offset (overview studio grip). */
  offsetY?: number
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void
}

function plateGrabHandlePosition(
  side: GrabHandleSide,
  vertical: GrabHandleVertical,
  hitSize: number,
  gripSize: number,
  offsetY = 0,
): { left: number | string; top?: number | string; bottom?: number | string } {
  if (gripSize === DRAG_GRIP_VISUAL_SIZE && offsetY === 0) {
    return {
      ...grabHandleHorizontalStyle(side, hitSize),
      ...grabHandleVerticalStyle(vertical, hitSize),
    }
  }

  const hitOutset = (hitSize - gripSize) / 2
  const offsetX = gripSize + GRAB_HANDLE_GAP
  const left =
    side === 'left'
      ? -(offsetX + hitOutset)
      : `calc(100% + ${GRAB_HANDLE_GAP - hitOutset}px)`

  if (vertical === 'top') {
    return { left, top: GRAB_HANDLE_TOP - hitOutset + offsetY, bottom: 'auto' }
  }
  return { left, bottom: -offsetY, top: 'auto' }
}

/** Top-left plate grip — shared by fisheye overview and expanded canvas map. */
export default function StudioPlateDragHandle({
  ariaLabel,
  concealed = false,
  hitSize = resolveCanvasHandleHitSize(),
  gripSize = DRAG_GRIP_VISUAL_SIZE,
  offsetY = 0,
  onPointerDown,
}: Props) {
  const { side, vertical } = PLACEMENT

  return (
    <div
      className={`studio-centre-drag-handle-wrapper${concealed ? ' overview-chrome--concealed' : ''}`}
      style={{
        position: 'absolute',
        ...plateGrabHandlePosition(side, vertical, hitSize, gripSize, offsetY),
        width: hitSize,
        height: hitSize,
        zIndex: 2,
      }}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        className="studio-centre-drag-handle"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          e.stopPropagation()
          onPointerDown(e)
        }}
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
        <DragGripIcon size={gripSize} side={side} />
      </button>
    </div>
  )
}

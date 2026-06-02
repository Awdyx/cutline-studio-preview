import { useEffect, useRef, useState } from 'react'
import DragGripIcon from './DragGripIcon'
import {
  grabHandleHorizontalStyle,
  grabHandlePlacementKey,
  grabHandleVerticalStyle,
  DRAG_GRIP_VISUAL_SIZE,
  resolveCanvasHandleHitSize,
  type GrabHandlePlacement,
} from './grabZone'

const SWAP_MS = 180

export default function DragHandle({
  placement,
  onPointerDown,
  hitSize = resolveCanvasHandleHitSize(),
}: {
  placement: GrabHandlePlacement
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void
  /** Override the invisible tap/drag target size (layout-aware default). */
  hitSize?: number
}) {
  const [shownPlacement, setShownPlacement] = useState(placement)
  const [revealed, setRevealed] = useState(true)
  const targetPlacementRef = useRef(placement)
  const swapTimerRef = useRef<number | null>(null)

  useEffect(() => {
    targetPlacementRef.current = placement
    if (grabHandlePlacementKey(placement) === grabHandlePlacementKey(shownPlacement)) {
      if (swapTimerRef.current !== null) {
        window.clearTimeout(swapTimerRef.current)
        swapTimerRef.current = null
      }
      setRevealed(true)
      return
    }

    setRevealed(false)
    if (swapTimerRef.current !== null) {
      window.clearTimeout(swapTimerRef.current)
    }

    swapTimerRef.current = window.setTimeout(() => {
      swapTimerRef.current = null
      setShownPlacement(targetPlacementRef.current)
      setRevealed(true)
    }, SWAP_MS)

    return () => {
      if (swapTimerRef.current !== null) {
        window.clearTimeout(swapTimerRef.current)
        swapTimerRef.current = null
      }
    }
  }, [placement, shownPlacement])

  return (
    <div
      className="canvas-item-drag-handle-wrapper"
      style={{
        position: 'absolute',
        ...grabHandleVerticalStyle(shownPlacement.vertical, hitSize),
        ...grabHandleHorizontalStyle(shownPlacement.side, hitSize),
        width: hitSize,
        height: hitSize,
        zIndex: 3,
        opacity: revealed ? 1 : 0,
        filter: revealed ? 'blur(0px)' : 'blur(10px)',
        transition: `opacity ${SWAP_MS}ms cubic-bezier(0.22, 1, 0.36, 1), filter ${SWAP_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        pointerEvents: revealed ? 'auto' : 'none',
        willChange: 'opacity, filter',
      }}
    >
      <button
        type="button"
        aria-label="Move or arrange canvas item"
        aria-haspopup="menu"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onPointerDown={onPointerDown}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems:
            shownPlacement.vertical === 'bottom' ? 'flex-end' : 'center',
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
        }}
        className="canvas-item-drag-handle"
      >
        <DragGripIcon size={DRAG_GRIP_VISUAL_SIZE} side={shownPlacement.side} />
      </button>
    </div>
  )
}

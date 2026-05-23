import { useEffect, useRef, useState } from 'react'
import { Grip } from 'lucide-react'
import {
  grabHandleHorizontalStyle,
  grabHandlePlacementKey,
  grabHandleVerticalStyle,
  HANDLE_HIT_SIZE,
  type GrabHandlePlacement,
} from './grabZone'

const SWAP_MS = 180

export default function DragHandle({
  placement,
  onPointerDown,
}: {
  placement: GrabHandlePlacement
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void
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
      style={{
        position: 'absolute',
        ...grabHandleVerticalStyle(shownPlacement.vertical),
        ...grabHandleHorizontalStyle(shownPlacement.side),
        width: HANDLE_HIT_SIZE,
        height: HANDLE_HIT_SIZE,
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
        <Grip size={13} strokeWidth={2} />
      </button>
    </div>
  )
}

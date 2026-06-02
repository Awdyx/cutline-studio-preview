import { motion } from 'framer-motion'
import { useCallback, useRef, useState } from 'react'
import { useCanvasItemsStore } from './canvasItemsStore'
import {
  STUDY_HUB_SCRATCH_PAD_EASE,
  STUDY_HUB_SCRATCH_PAD_GAP,
  STUDY_HUB_SCRATCH_PAD_TRANSITION_MS,
  STUDY_HUB_SCRATCH_SPLIT_HANDLE_WIDTH,
} from './studyHubMenuFocusLayout'

export default function StudyHubMenuFocusSplitHandle({
  left,
  height,
  splittableW,
  smoothLayout = false,
  onDragStart,
  onDragEnd,
}: {
  left: number
  height: number
  splittableW: number
  smoothLayout?: boolean
  onDragStart?: () => void
  onDragEnd?: () => void
}) {
  const setSplitShare = useCanvasItemsStore((s) => s.setMenuFocusScratchSplitShare)
  const [dragging, setDragging] = useState(false)
  const startXRef = useRef<number | null>(null)
  const shareRef = useRef(useCanvasItemsStore.getState().menuFocusScratchSplitShare ?? 0.5)

  const bumpShare = useCallback(
    (deltaX: number) => {
      if (splittableW <= 0) return
      const next = Math.max(
        0,
        Math.min(1, shareRef.current - deltaX / splittableW),
      )
      shareRef.current = next
      setSplitShare(next)
    },
    [setSplitShare, splittableW],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation()
      e.preventDefault()
      const store = useCanvasItemsStore.getState()
      shareRef.current = store.menuFocusScratchSplitShare ?? shareRef.current
      e.currentTarget.setPointerCapture(e.pointerId)
      startXRef.current = e.clientX
      setDragging(true)
      onDragStart?.()
    },
    [onDragStart],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (startXRef.current === null) return
      const delta = e.clientX - startXRef.current
      startXRef.current = e.clientX
      bumpShare(delta)
    },
    [bumpShare],
  )

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (startXRef.current === null) return
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      startXRef.current = null
      setDragging(false)
      onDragEnd?.()
    },
    [onDragEnd],
  )

  const handleLeft =
    left + (STUDY_HUB_SCRATCH_PAD_GAP - STUDY_HUB_SCRATCH_SPLIT_HANDLE_WIDTH) / 2

  return (
    <motion.div
      className="study-hub-menu-focus-frame__split"
      data-study-hub-scratch-split=""
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize study widget and draw pad"
      initial={false}
      animate={{ left: handleLeft }}
      transition={
        smoothLayout
          ? {
              duration: STUDY_HUB_SCRATCH_PAD_TRANSITION_MS / 1000,
              ease: STUDY_HUB_SCRATCH_PAD_EASE,
            }
          : { duration: 0 }
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{
        position: 'absolute',
        top: 0,
        width: STUDY_HUB_SCRATCH_SPLIT_HANDLE_WIDTH,
        height,
        cursor: dragging ? 'ew-resize' : 'col-resize',
        touchAction: 'none',
        zIndex: 4,
      }}
    />
  )
}

import { motion, type Transition } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { playSound } from '../sound/playSound'
import {
  startItemDragSound,
  stopItemDragSound,
  updateItemDragSound,
} from '../sound/itemDragSound'
import { useCanvasItemsStore } from './canvasItemsStore'
import {
  STUDY_HUB_SCRATCH_PAD_EASE,
  STUDY_HUB_SCRATCH_PAD_GAP,
  STUDY_HUB_SCRATCH_PAD_TRANSITION_MS,
  STUDY_HUB_SCRATCH_SPLIT_HANDLE_WIDTH,
  STUDY_HUB_SCRATCH_SPLIT_RUBBER_BAND,
} from './studyHubMenuFocusLayout'

export default function StudyHubMenuFocusSplitHandle({
  left,
  height,
  scratchTravel,
  splitShare,
  smoothLayout = false,
  panelTransition,
  onDragStart,
  onDragEnd,
  onOvershootChange,
}: {
  left: number
  height: number
  /** Scratch width range (max − min) — 1px drag moves the split 1px. */
  scratchTravel: number
  /** Share already used by menu-focus layout (auto-fit when store is null). */
  splitShare: number
  smoothLayout?: boolean
  panelTransition?: Transition
  onDragStart?: () => void
  onDragEnd?: () => void
  onOvershootChange?: (px: number) => void
}) {
  const setSplitShare = useCanvasItemsStore((s) => s.setMenuFocusScratchSplitShare)
  const [dragging, setDragging] = useState(false)
  const startXRef = useRef<number | null>(null)
  const shareRef = useRef(splitShare)
  const dragEngagedRef = useRef(false)
  const dragSoundActiveRef = useRef(false)

  useEffect(() => {
    if (!dragging) shareRef.current = splitShare
  }, [splitShare, dragging])

  useEffect(() => () => stopItemDragSound(), [])

  const beginSplitDragSound = useCallback(() => {
    if (dragSoundActiveRef.current) return
    dragSoundActiveRef.current = true
    playSound('itemGrab')
    startItemDragSound()
  }, [])

  const endSplitDragSound = useCallback((moved: boolean) => {
    if (!dragSoundActiveRef.current) return
    dragSoundActiveRef.current = false
    stopItemDragSound()
    if (moved) playSound('itemDrop')
  }, [])

  const bumpShare = useCallback(
    (deltaX: number) => {
      if (scratchTravel <= 0) return
      const raw = shareRef.current - deltaX / scratchTravel
      const next = Math.max(0, Math.min(1, raw))
      let overshootPx = 0
      if (raw > 1) {
        overshootPx = (raw - 1) * scratchTravel * STUDY_HUB_SCRATCH_SPLIT_RUBBER_BAND
      } else if (raw < 0) {
        overshootPx = raw * scratchTravel * STUDY_HUB_SCRATCH_SPLIT_RUBBER_BAND
      }
      shareRef.current = next
      setSplitShare(next)
      onOvershootChange?.(overshootPx)
    },
    [onOvershootChange, setSplitShare, scratchTravel],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation()
      e.preventDefault()
      shareRef.current = splitShare
      e.currentTarget.setPointerCapture(e.pointerId)
      startXRef.current = e.clientX
      dragEngagedRef.current = false
      setDragging(true)
    },
    [splitShare],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (startXRef.current === null) return
      const delta = e.clientX - startXRef.current
      if (delta === 0) return
      if (!dragEngagedRef.current) {
        dragEngagedRef.current = true
        onDragStart?.()
        beginSplitDragSound()
      }
      startXRef.current = e.clientX
      updateItemDragSound(e.clientX, e.clientY)
      bumpShare(delta)
    },
    [beginSplitDragSound, bumpShare, onDragStart],
  )

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (startXRef.current === null) return
      const moved = dragEngagedRef.current
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      startXRef.current = null
      dragEngagedRef.current = false
      setDragging(false)
      endSplitDragSound(moved)
      onDragEnd?.()
    },
    [endSplitDragSound, onDragEnd],
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
        panelTransition ??
        (smoothLayout
          ? {
              duration: STUDY_HUB_SCRATCH_PAD_TRANSITION_MS / 1000,
              ease: STUDY_HUB_SCRATCH_PAD_EASE,
            }
          : { duration: 0 })
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

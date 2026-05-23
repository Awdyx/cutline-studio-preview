import { useCallback, useMemo, useRef, useState, type RefObject } from 'react'
import { motion } from 'framer-motion'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../drawing/canvasDimensions'
import { playSound } from '../sound/playSound'
import { isItemFrozen } from '../canvasLock/layer'
import { useCanvasLockStore } from '../canvasLock/canvasLockStore'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import { useDeferredCanvasTap } from '../canvas/useDeferredCanvasTap'
import { useCanvasNavigationStore } from '../canvas/canvasNavigationStore'
import { shouldSkipItemSelectForOutsideDismiss } from '../canvas/canvasSelectionDismiss'
import DragHandle from './DragHandle'
import { getSoleSelectedItemId } from './canvasItemZMenuLayout'
import { getGrabHandlePlacement } from './grabZone'
import { useCanvasItemDrag } from './useCanvasItemDrag'
import { useSpacePreviewPanDrag } from './useSpacePreviewPanDrag'
import { useCanvasItemsStore } from './canvasItemsStore'
import SpaceCardPreview from '../spaces/SpaceCardPreview'
import { card, font, glass, SPACE_GLASS_CLASS } from '../styles/tokens'
import type { SpaceCanvasItem } from './types'
import {
  canvasItemDeleteExit,
  canvasItemDeleteExitTransition,
} from './canvasItemMotion'

const DRAG_THRESHOLD_PX = 10
const liftSpring = { type: 'spring' as const, stiffness: 380, damping: 28, mass: 0.7 }

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1)
}

export default function SpaceItem({
  item,
  transformRef,
  liftZIndex,
}: {
  item: SpaceCanvasItem
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  liftZIndex?: number
}) {
  const isLocked = useCanvasLockStore((s) => s.isLocked)
  const frozen = isItemFrozen(item, isLocked)
  const transitionPhase = useCanvasWorkspaceStore((s) => s.transition.phase)
  const spaceMeta = useCanvasWorkspaceStore((s) => s.spaces[item.id])
  const selectedIds = useCanvasItemsStore((s) => s.selectedIds)
  const selectItem = useCanvasItemsStore((s) => s.selectItem)
  const displayName = spaceMeta?.name ?? item.name
  const hasPreviewContent =
    !!spaceMeta &&
    (spaceMeta.items.length > 0 ||
      spaceMeta.strokes.length > 0 ||
      spaceMeta.annotationStrokes.length > 0)
  const cardRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const previewPhaseRef = useRef<'idle' | 'pending'>('idle')
  const previewPointerRef = useRef({ startX: 0, startY: 0 })

  const previewAdjustSpaceId = useCanvasItemsStore((s) => s.previewAdjustSpaceId)
  const isPreviewAdjusting = previewAdjustSpaceId === item.id

  const { isDragging, onGrabPointerDown } = useCanvasItemDrag(item.id)
  const {
    isPanDragging,
    onPreviewAdjustPointerDown,
    onPreviewAdjustPointerMove,
    onPreviewAdjustPointerUp,
    onPreviewAdjustPointerCancel,
  } = useSpacePreviewPanDrag(item, previewRef, isPreviewAdjusting)

  const isSelected = liftZIndex != null || selectedIds.includes(item.id)
  const hideDragHandle = getSoleSelectedItemId(selectedIds) === item.id

  const enterSpace = useCallback(() => {
    const el = cardRef.current
    if (!el || transitionPhase !== 'idle') return
    const rect = el.getBoundingClientRect()
    const workspace = useCanvasWorkspaceStore.getState()
    playSound('spaceEnter')
    workspace.beginEnterSpace(item.id, rect)
    setTimeout(() => {
      workspace.completeEnterSpace(transformRef.current)
    }, 280)
  }, [item.id, transformRef, transitionPhase])

  const shellSelectTap = useDeferredCanvasTap((e) => {
    if (shouldSkipItemSelectForOutsideDismiss(item.id)) return
    selectItem(item.id, e.shiftKey)
  })

  const handleShellPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (frozen || e.pointerType === 'pen') return
      if (isSelected) {
        onGrabPointerDown(e as React.PointerEvent<HTMLElement>)
        return
      }
      shellSelectTap.onPointerDown(e)
    },
    [frozen, isSelected, onGrabPointerDown, shellSelectTap],
  )

  const handlePreviewPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === 'pen') return
      e.stopPropagation()
      if (isPreviewAdjusting) {
        onPreviewAdjustPointerDown(e)
        return
      }
      previewPhaseRef.current = 'pending'
      previewPointerRef.current = { startX: e.clientX, startY: e.clientY }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [isPreviewAdjusting, onPreviewAdjustPointerDown],
  )

  const handlePreviewPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isPreviewAdjusting) {
        onPreviewAdjustPointerMove(e)
        return
      }
      if (previewPhaseRef.current !== 'pending') return
      const { startX, startY } = previewPointerRef.current
      if (dist(e.clientX, e.clientY, startX, startY) > DRAG_THRESHOLD_PX) {
        previewPhaseRef.current = 'idle'
        try {
          ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
        } catch {
          // ignore
        }
      }
    },
    [isPreviewAdjusting, onPreviewAdjustPointerMove],
  )

  const handlePreviewPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (isPreviewAdjusting) {
        onPreviewAdjustPointerUp(e)
        return
      }
      if (
        previewPhaseRef.current === 'pending' &&
        !useCanvasNavigationStore.getState().shouldSuppressItemTap()
      ) {
        enterSpace()
      }
      previewPhaseRef.current = 'idle'
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    },
    [enterSpace, isPreviewAdjusting, onPreviewAdjustPointerUp],
  )

  const handlePreviewPointerCancel = useCallback(
    (e: React.PointerEvent) => {
      if (isPreviewAdjusting) {
        onPreviewAdjustPointerCancel(e)
        return
      }
      handlePreviewPointerUp(e)
    },
    [handlePreviewPointerUp, isPreviewAdjusting, onPreviewAdjustPointerCancel],
  )

  const [hovered, setHovered] = useState(false)
  const lifted = isDragging
  const canHover = !frozen && !isLocked
  const grabHandlePlacement = useMemo(
    () =>
      getGrabHandlePlacement(
        item.x,
        item.y,
        item.width,
        item.height,
        CANVAS_WIDTH,
        CANVAS_HEIGHT,
      ),
    [item.x, item.y, item.width, item.height],
  )

  return (
    <motion.div
      ref={cardRef}
      data-canvas-item="space"
      data-item-id={item.id}
      data-active={lifted || undefined}
      data-selected={isSelected || undefined}
      exit={{
        ...canvasItemDeleteExit,
        transition: canvasItemDeleteExitTransition,
      }}
      animate={{
        scale: lifted ? 1.03 : canHover && hovered ? 1.01 : 1,
        boxShadow: lifted ? card.shadow : glass.shadow,
      }}
      transition={liftSpring}
      onMouseEnter={() => canHover && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        left: item.x,
        top: item.y,
        width: item.width,
        height: item.height,
        zIndex: liftZIndex ?? item.zIndex,
        transformOrigin: 'top left',
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      {!frozen && !hideDragHandle && (
        <div data-lock-flatten-skip>
          <DragHandle
            placement={grabHandlePlacement}
            onPointerDown={onGrabPointerDown}
          />
        </div>
      )}

      {/* Stacked card shadow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 6,
          top: 6,
          right: -6,
          bottom: -6,
          borderRadius: 6,
          background: 'var(--glass-border)',
          boxShadow: glass.shadow,
          pointerEvents: 'none',
          opacity: 0.7,
        }}
      />

      <div
        onPointerDown={handleShellPointerDown}
        onPointerMove={shellSelectTap.onPointerMove}
        onPointerUp={shellSelectTap.onPointerUp}
        onPointerCancel={shellSelectTap.onPointerCancel}
        className={`theme-surface ${SPACE_GLASS_CLASS}${isSelected ? ' canvas-item-selected-focus' : ''}`}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: 6,
          background: glass.bg,
          border: glass.border,
          boxShadow: glass.shadow,
          overflow: 'hidden',
          pointerEvents: 'auto',
          cursor: 'default',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '10px 12px 12px',
            fontSize: 16,
            fontWeight: 500,
            color: font.colorMuted,
            lineHeight: 1.2,
            flexShrink: 0,
            userSelect: 'none',
          }}
        >
          {displayName}
        </div>
        <div
          ref={previewRef}
          role="button"
          tabIndex={0}
          data-space-preview=""
          className={isPreviewAdjusting ? 'space-preview-adjust' : undefined}
          aria-label={
            isPreviewAdjusting
              ? `Adjust preview for space: ${displayName}`
              : `Open space: ${displayName}`
          }
          onPointerDown={handlePreviewPointerDown}
          onPointerMove={handlePreviewPointerMove}
          onPointerUp={handlePreviewPointerUp}
          onPointerCancel={handlePreviewPointerCancel}
          onKeyDown={(e) => {
            if (isPreviewAdjusting) return
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              enterSpace()
            }
          }}
          style={{
            flex: 1,
            margin: '0 10px 10px',
            borderRadius: 4,
            overflow: 'hidden',
            position: 'relative',
            minHeight: 0,
            background: card.bg,
            boxShadow: 'inset 0 0 0 1px var(--glass-border)',
            cursor: isPreviewAdjusting
              ? isPanDragging
                ? 'grabbing'
                : 'grab'
              : canHover
                ? 'pointer'
                : 'default',
            touchAction: isPreviewAdjusting ? 'none' : undefined,
          }}
        >
          {hasPreviewContent ? (
            <SpaceCardPreview spaceId={item.id} previewPan={item.previewPan} />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 4,
                border: '1.5px dashed var(--glass-border)',
                background: 'var(--canvas-bg)',
              }}
            />
          )}
        </div>
      </div>
    </motion.div>
  )
}

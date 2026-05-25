import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { motion } from 'framer-motion'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../drawing/canvasDimensions'
import { playSound } from '../sound/playSound'
import { isItemFrozen } from '../canvasLock/layer'
import { useCanvasLockStore } from '../canvasLock/canvasLockStore'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import { DEFAULT_SPACE_NAME } from '../spaces/types'
import { useCanvasNavigationStore } from '../canvas/canvasNavigationStore'
import { useCanvasItemAreaPointer } from '../canvas/useCanvasItemAreaPointer'
import { useCanvasEditingAllowed } from '../canvasEdit/layer'
import DragHandle from './DragHandle'
import ResizeHandle from './ResizeHandle'
import { displayZIndexForCanvasItem } from './canvasZOrder'
import { getGrabHandlePlacement, SPACE_RESIZE_CORNER_OUTSET } from './grabZone'
import { useCanvasItemDrag } from './useCanvasItemDrag'
import { useCanvasItemDragStore } from './canvasItemDragStore'
import { useCanvasItemResize } from './useCanvasItemResize'
import { useSpacePreviewPanDrag } from './useSpacePreviewPanDrag'
import {
  useCanvasItemsStore,
  useItemIsSoleSelected,
  useItemSelected,
} from './canvasItemsStore'
import SpaceCardPreview from '../spaces/SpaceCardPreview'
import { useSpaceDropStore } from '../spaces/spaceDropStore'
import { card, font, glass, SPACE_GLASS_CLASS } from '../styles/tokens'
import type { SpaceCanvasItem } from './types'
import {
  canvasItemDeleteExit,
  canvasItemDeleteExitTransition,
} from './canvasItemMotion'
import {
  resolveItemTextAlignment,
  textAlignmentEditorStyle,
} from './textAlignment'

const DRAG_THRESHOLD_PX = 10
const liftSpring = { type: 'spring' as const, stiffness: 380, damping: 28, mass: 0.7 }

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1)
}

export default function SpaceItem({
  item,
  transformRef,
  onItemResizeStateChange,
}: {
  item: SpaceCanvasItem
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  onItemResizeStateChange?: (resizing: boolean) => void
}) {
  const isLocked = useCanvasLockStore((s) => s.isLocked)
  const frozen = isItemFrozen(item, isLocked)
  const spaceMeta = useCanvasWorkspaceStore((s) => s.spaces[item.id])
  const displayName = spaceMeta?.name ?? item.name
  const isDefaultName =
    displayName.trim().toLowerCase() === DEFAULT_SPACE_NAME.toLowerCase()
  const titleLabel = isDefaultName ? 'untitled space' : displayName
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
  const { isResizing, handlePointerDown: onResizeDown } = useCanvasItemResize(
    item.id,
    item.width,
    item.height,
    transformRef,
    onItemResizeStateChange,
  )
  const {
    isPanDragging,
    onPreviewAdjustPointerDown,
    onPreviewAdjustPointerMove,
    onPreviewAdjustPointerUp,
    onPreviewAdjustPointerCancel,
  } = useSpacePreviewPanDrag(item, previewRef, isPreviewAdjusting)

  const isSelected = useItemSelected(item.id)
  const isSoleSelected = useItemIsSoleSelected(item.id)
  const editingAllowed = useCanvasEditingAllowed()
  const zMenuSuppressedItemId = useCanvasItemsStore((s) => s.zMenuSuppressedItemId)
  const selectedIds = useCanvasItemsStore((s) => s.selectedIds)
  const allItems = useCanvasItemsStore((s) => s.items)
  const dropHoverSpaceId = useSpaceDropStore((s) => s.hover?.spaceId ?? null)
  const dropConfirmSpaceId = useSpaceDropStore((s) => s.confirmPulseSpaceId)
  const dropConfirmNonce = useSpaceDropStore((s) => s.confirmPulseNonce)
  const isDropHoverTarget = dropHoverSpaceId === item.id
  const dragActiveItemId = useCanvasItemDragStore((s) => s.activeItemId)
  /**
   * Only ease-blur the space when the dim overlay is actually visible (i.e. a
   * selection is active). Dragging via the handle starts a drag without
   * selecting the item, so the dim never appears and the space shouldn't
   * pretend to be dim'd.
   */
  const selectionActive = selectedIds.length > 0
  /** During a drag, lift other spaces above the dim so we can ease their blur via an own CSS filter (z-flip would be a hard cut). */
  const dragLift =
    selectionActive &&
    dragActiveItemId != null &&
    dragActiveItemId !== item.id &&
    !isSelected
  const ownBlurActive = dragLift && !isDropHoverTarget
  /**
   * Drag start force-lifts the space above the dim — without this gate, the
   * filter would animate from 0 → 7px and flash the card clear for a moment.
   * We snap the filter into place on drag start, then enable easing one frame
   * later so subsequent hover-target toggles transition smoothly.
   */
  const [easeBlur, setEaseBlur] = useState(false)
  useLayoutEffect(() => {
    if (!dragLift) {
      setEaseBlur(false)
      return
    }
    const id = requestAnimationFrame(() => setEaseBlur(true))
    return () => {
      cancelAnimationFrame(id)
      setEaseBlur(false)
    }
  }, [dragLift])
  const [dropConfirmClass, setDropConfirmClass] = useState<string | null>(null)
  const lastDropConfirmNonce = useRef(0)

  useEffect(() => {
    if (dropConfirmSpaceId !== item.id) return
    if (dropConfirmNonce === lastDropConfirmNonce.current) return
    lastDropConfirmNonce.current = dropConfirmNonce
    setDropConfirmClass('space-preview-drop-confirm')
    const timer = window.setTimeout(() => setDropConfirmClass(null), 360)
    return () => window.clearTimeout(timer)
  }, [dropConfirmNonce, dropConfirmSpaceId, item.id])

  const hideDragHandle =
    isSoleSelected && editingAllowed && zMenuSuppressedItemId !== item.id
  const displayZIndex = useMemo(
    () =>
      displayZIndexForCanvasItem(allItems, item, selectedIds, {
        forceLift: isDropHoverTarget || dragLift,
        isActiveDrag: isDragging,
      }),
    [allItems, item, selectedIds, isDropHoverTarget, dragLift, isDragging],
  )

  const enterSpace = useCallback(() => {
    if (useCanvasWorkspaceStore.getState().canvasSwapBusy) return
    playSound('spaceEnter')
    useCanvasWorkspaceStore
      .getState()
      .enterSpace(item.id, transformRef.current)
  }, [item.id, transformRef])

  const areaPointer = useCanvasItemAreaPointer({
    itemId: item.id,
    isSelected,
    frozen,
    moveBlocked: false,
    onGrabPointerDown,
  })

  const handlePreviewPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === 'pen') return
      e.stopPropagation()
      if (e.pointerType === 'mouse' && e.button === 2) {
        areaPointer.onPointerDown(e)
        return
      }
      if (isPreviewAdjusting) {
        onPreviewAdjustPointerDown(e)
        return
      }
      previewPhaseRef.current = 'pending'
      previewPointerRef.current = { startX: e.clientX, startY: e.clientY }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [areaPointer, isPreviewAdjusting, onPreviewAdjustPointerDown],
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
  const lifted = isDragging || isResizing
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
  const handleOcclusionKey = `${item.x},${item.y},${item.width},${item.height},${item.zIndex},${displayZIndex}`

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
        zIndex: displayZIndex,
        transformOrigin: 'top left',
        overflow: 'visible',
        pointerEvents: 'none',
        filter: ownBlurActive ? 'blur(7px)' : dragLift ? 'blur(0px)' : 'none',
        transition: easeBlur ? 'filter 220ms ease-out' : 'none',
        willChange: dragLift ? 'filter' : undefined,
      }}
    >
      {!frozen && (
        <div data-lock-flatten-skip>
          {!hideDragHandle && (
            <DragHandle
              placement={grabHandlePlacement}
              onPointerDown={onGrabPointerDown}
              occlusionRevisionKey={handleOcclusionKey}
              occlusionActive={isSelected}
            />
          )}
          <ResizeHandle
            onPointerDown={onResizeDown}
            cornerOutset={SPACE_RESIZE_CORNER_OUTSET}
            occlusionRevisionKey={handleOcclusionKey}
            occlusionActive={isSelected}
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
        onPointerDown={areaPointer.onPointerDown}
        onPointerMove={areaPointer.onPointerMove}
        onPointerUp={areaPointer.onPointerUp}
        onPointerCancel={areaPointer.onPointerCancel}
        onContextMenu={areaPointer.onContextMenu}
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
          cursor: 'var(--cursor-default)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '10px 12px 12px',
            fontSize: 16,
            fontWeight: 500,
            color: isDefaultName ? font.colorFaint : font.colorMuted,
            opacity: isDefaultName ? 0.55 : 1,
            lineHeight: 1.2,
            flexShrink: 0,
            userSelect: 'none',
            ...textAlignmentEditorStyle(resolveItemTextAlignment(item)),
          }}
        >
          {titleLabel}
        </div>
        <div
          ref={previewRef}
          role="button"
          tabIndex={0}
          data-space-preview=""
          className={[
            isPreviewAdjusting ? 'space-preview-adjust' : null,
            isDropHoverTarget ? 'space-preview-drop-hover' : null,
            dropConfirmClass,
          ]
            .filter(Boolean)
            .join(' ') || undefined}
          aria-label={
            isPreviewAdjusting
              ? `Adjust preview for space: ${displayName}`
              : `Open space: ${displayName}`
          }
          onPointerDown={handlePreviewPointerDown}
          onPointerMove={handlePreviewPointerMove}
          onPointerUp={handlePreviewPointerUp}
          onPointerCancel={handlePreviewPointerCancel}
          onContextMenu={areaPointer.onContextMenu}
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
          {hasPreviewContent || isDropHoverTarget ? (
            <SpaceCardPreview
              spaceId={item.id}
              previewPan={item.previewPan}
              showDropGhost={isDropHoverTarget}
            />
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

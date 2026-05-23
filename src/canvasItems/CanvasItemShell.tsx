import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../drawing/canvasDimensions'
import { isItemFrozen } from '../canvasLock/layer'
import { useCanvasLockStore } from '../canvasLock/canvasLockStore'
import { useCanvasItemsStore } from './canvasItemsStore'
import DragHandle from './DragHandle'
import ResizeHandle from './ResizeHandle'
import { getSoleSelectedItemId } from './canvasItemZMenuLayout'
import { getGrabHandlePlacement } from './grabZone'
import { useCanvasItemDrag } from './useCanvasItemDrag'
import { useCanvasItemResize } from './useCanvasItemResize'
import { useDeferredCanvasTap } from '../canvas/useDeferredCanvasTap'
import { shouldSkipItemSelectForOutsideDismiss } from '../canvas/canvasSelectionDismiss'
import type { CanvasItem } from './types'
import {
  canvasItemDeleteExit,
  canvasItemDeleteExitTransition,
} from './canvasItemMotion'

const liftSpring = { type: 'spring' as const, stiffness: 380, damping: 28, mass: 0.7 }

export default function CanvasItemShell({
  item,
  transformRef,
  onItemResizeStateChange,
  liftZIndex,
  children,
}: {
  item: CanvasItem
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  onItemResizeStateChange?: (resizing: boolean) => void
  /** When set, item is raised above the selection blur overlay. */
  liftZIndex?: number
  children: React.ReactNode
}) {
  const { isDragging, onGrabPointerDown } = useCanvasItemDrag(item.id)

  const { isResizing, handlePointerDown: onResizeDown } = useCanvasItemResize(
    item.id,
    item.width,
    item.height,
    transformRef,
    onItemResizeStateChange,
  )

  const isLocked = useCanvasLockStore((s) => s.isLocked)
  const frozen = isItemFrozen(item, isLocked)
  const selectedIds = useCanvasItemsStore((s) => s.selectedIds)
  const zOrderPulse = useCanvasItemsStore((s) => s.zOrderPulse)
  const isSelected = liftZIndex != null || selectedIds.includes(item.id)
  const hideDragHandle = getSoleSelectedItemId(selectedIds) === item.id
  const [zPulseClass, setZPulseClass] = useState<string | null>(null)
  const lastZPulseNonce = useRef(0)

  useEffect(() => {
    if (!zOrderPulse || zOrderPulse.id !== item.id) return
    if (zOrderPulse.nonce === lastZPulseNonce.current) return
    lastZPulseNonce.current = zOrderPulse.nonce
    setZPulseClass(
      zOrderPulse.dir === 'front'
        ? 'canvas-item-z-pulse-front'
        : 'canvas-item-z-pulse-back',
    )
    const timer = window.setTimeout(() => setZPulseClass(null), 360)
    return () => window.clearTimeout(timer)
  }, [zOrderPulse, item.id])
  const selectItem = useCanvasItemsStore((s) => s.selectItem)
  const itemTap = useDeferredCanvasTap((e) => {
    if (shouldSkipItemSelectForOutsideDismiss(item.id)) return
    selectItem(item.id, e.shiftKey)
  })
  const displayZIndex = liftZIndex ?? item.zIndex
  const isFlatItem =
    item.type === 'text' || item.type === 'image' || item.type === 'video'
  const lifted = isDragging || isResizing
  const clipContent = item.type === 'sticky' || item.type === 'text'
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
      data-canvas-item={item.type}
      data-item-id={item.id}
      data-active={lifted || undefined}
      data-selected={isSelected || undefined}
      exit={{
        ...canvasItemDeleteExit,
        transition: canvasItemDeleteExitTransition,
      }}
      animate={{
        scale: isFlatItem ? 1 : lifted ? 1.03 : 1,
        boxShadow: isFlatItem
          ? 'none'
          : lifted
            ? '0 12px 40px rgba(20, 30, 50, 0.22)'
            : '0 2px 10px rgba(20, 30, 50, 0.12)',
      }}
      transition={liftSpring}
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
      }}
    >
      {!frozen && (
        <div data-lock-flatten-skip>
          {!hideDragHandle && (
            <DragHandle
              placement={grabHandlePlacement}
              onPointerDown={onGrabPointerDown}
            />
          )}
          <ResizeHandle onPointerDown={onResizeDown} />
        </div>
      )}
      <div
        onPointerDown={(e) => {
          if (frozen || e.pointerType === 'pen') return
          if (e.target instanceof HTMLElement && e.target.closest('button')) return
          if (isSelected) {
            onGrabPointerDown(e)
            return
          }
          itemTap.onPointerDown(e)
        }}
        onPointerMove={itemTap.onPointerMove}
        onPointerUp={itemTap.onPointerUp}
        onPointerCancel={itemTap.onPointerCancel}
        className={[
          isSelected ? 'canvas-item-selected-focus' : null,
          zPulseClass,
        ]
          .filter(Boolean)
          .join(' ') || undefined}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: item.type === 'sticky' ? 4 : isFlatItem ? 0 : 8,
          overflow: clipContent ? 'hidden' : 'visible',
          pointerEvents: 'auto',
        }}
      >
        {children}
      </div>
    </motion.div>
  )
}

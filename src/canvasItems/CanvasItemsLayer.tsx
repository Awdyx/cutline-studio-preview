import { useMemo, type RefObject } from 'react'
import { AnimatePresence } from 'framer-motion'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { useCanvasLockFlattenStore } from '../canvasLock/canvasLockFlattenStore'
import {
  isCommittedHiddenWhenFlattened,
  shouldFlattenCanvas,
  stickyNeedsAnnotationOverlay,
} from '../canvasLock/flattenVisibility'
import { useCanvasLockStore } from '../canvasLock/canvasLockStore'
import {
  isAboveStrokes,
  isAnnotationItem,
  isBelowStrokes,
  Z_SELECTION_ABOVE_DIM,
} from './canvasZOrder'
import { useCanvasItemsStore } from './canvasItemsStore'
import ImageItem from './ImageItem'
import StickyNote from './StickyNote'
import StickyAnnotationOverlay from './StickyAnnotationOverlay'
import TextItem from './TextItem'
import VideoItem from './VideoItem'
import SpaceItem from './SpaceItem'
import type { CanvasItem, StickyCanvasItem } from './types'

export default function CanvasItemsLayer({
  transformRef,
  onItemResizeStateChange,
  plane,
}: {
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  onItemResizeStateChange?: (resizing: boolean) => void
  plane: 'below' | 'above' | 'annotation'
}) {
  const items = useCanvasItemsStore((s) => s.items)
  const selectedIds = useCanvasItemsStore((s) => s.selectedIds)
  const activeStickyId = useCanvasItemsStore((s) => s.activeStickyStroke?.stickyId ?? null)
  const isLocked = useCanvasLockStore((s) => s.isLocked)
  const flattenReady = useCanvasLockFlattenStore((s) => s.ready)
  const liveGifIds = useCanvasLockFlattenStore((s) => s.liveGifIds)
  const lockActive = shouldFlattenCanvas(isLocked)
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const sorted = useMemo(() => {
    const filtered =
      plane === 'below'
        ? items.filter((i) => !isAnnotationItem(i) && isBelowStrokes(i.zIndex))
        : plane === 'above'
          ? items.filter((i) => !isAnnotationItem(i) && isAboveStrokes(i.zIndex))
          : items.filter(isAnnotationItem)
    return [...filtered].sort((a, b) => a.zIndex - b.zIndex)
  }, [items, plane, selectedSet])

  const overlayStickies = useMemo(() => {
    if (plane === 'annotation' || !lockActive || !flattenReady) return []
    return items.filter(
      (item): item is StickyCanvasItem =>
        item.type === 'sticky' &&
        stickyNeedsAnnotationOverlay(
          item,
          lockActive,
          flattenReady,
          liveGifIds,
          activeStickyId,
        ),
    )
  }, [items, plane, lockActive, flattenReady, liveGifIds, activeStickyId])

  if (sorted.length === 0 && overlayStickies.length === 0) return null

  const ariaLabel =
    plane === 'below'
      ? 'Canvas items below drawing'
      : plane === 'above'
        ? 'Canvas items above drawing'
        : 'Temporary canvas annotations'

  function renderItem(item: CanvasItem) {
    const selectedIndex = selectedIds.indexOf(item.id)
    const liftZIndex =
      selectedIndex >= 0 ? Z_SELECTION_ABOVE_DIM + selectedIndex : undefined
    const shellProps = {
      transformRef,
      onItemResizeStateChange,
      liftZIndex,
    }

    if (
      isCommittedHiddenWhenFlattened(item, lockActive, flattenReady, liveGifIds)
    ) {
      return null
    }

    if (item.type === 'sticky') {
      return <StickyNote key={item.id} item={item} {...shellProps} />
    }
    if (item.type === 'text') {
      return <TextItem key={item.id} item={item} {...shellProps} />
    }
    if (item.type === 'image') {
      return <ImageItem key={item.id} item={item} {...shellProps} />
    }
    if (item.type === 'space') {
      return (
        <SpaceItem
          key={item.id}
          item={item}
          transformRef={transformRef}
          onItemResizeStateChange={onItemResizeStateChange}
          liftZIndex={liftZIndex}
        />
      )
    }
    return <VideoItem key={item.id} item={item} {...shellProps} />
  }

  return (
    <>
      <div
        aria-label={ariaLabel}
        data-lock-layer={plane === 'annotation' ? 'annotation' : undefined}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }}
      >
        <AnimatePresence initial={false}>
          {sorted.map((item) => renderItem(item))}
        </AnimatePresence>
      </div>
      {overlayStickies.map((item) => (
        <StickyAnnotationOverlay key={`${item.id}-annotation`} item={item} />
      ))}
    </>
  )
}

import { useMemo, type RefObject } from 'react'
import { AnimatePresence } from 'framer-motion'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { useCanvasLockFlattenStore } from '../canvasLock/canvasLockFlattenStore'
import {
  shouldFlattenCanvas,
  stickyNeedsAnnotationOverlay,
} from '../canvasLock/flattenVisibility'
import { useCanvasLockStore } from '../canvasLock/canvasLockStore'
import {
  useCanvasItemsStore,
  useDrawableSurfaces,
  useLiveCandidatesByPlane,
  useSortedItemsByPlane,
} from './canvasItemsStore'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import ImageItem from './ImageItem'
import StickyNote from './StickyNote'
import StickyAnnotationOverlay from './StickyAnnotationOverlay'
import TextItem from './TextItem'
import VideoItem from './VideoItem'
import SpaceItem from './SpaceItem'
import StudyHubItem from './StudyHubItem'
import type { CanvasItem, StickyCanvasItem } from './types'
import { isImageInSticky } from './types'

const EMPTY_ITEMS: readonly CanvasItem[] = []
const EMPTY_DRAWABLES: readonly StickyCanvasItem[] = []

export default function CanvasItemsLayer({
  transformRef,
  onItemResizeStateChange,
  plane,
}: {
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  onItemResizeStateChange?: (resizing: boolean) => void
  plane: 'below' | 'above' | 'annotation'
}) {
  const activeCanvasId = useCanvasWorkspaceStore((s) => s.activeCanvasId)
  const activeStickyId = useCanvasItemsStore((s) => s.activeStickyStroke?.stickyId ?? null)
  const isLocked = useCanvasLockStore((s) => s.isLocked)
  const flattenReady = useCanvasLockFlattenStore((s) => s.ready)
  const liveGifIds = useCanvasLockFlattenStore((s) => s.liveGifIds)
  const lockActive = shouldFlattenCanvas(isLocked)
  const flattenHidesCommitted = lockActive && flattenReady

  // Sorted items per plane come from a cached derivation in the store so all
  // three CanvasItemsLayer instances share one sort and re-renders driven by
  // unrelated state changes don't re-run the comparator.
  const planeItems = useSortedItemsByPlane(plane)

  // When the canvas is flattened, committed items are baked into the bitmap
  // layer — iterate only the small live-candidate list (spaces + GIFs) for
  // the below/above planes and skip the full items array entirely.
  const liveBelow = useLiveCandidatesByPlane('below')
  const liveAbove = useLiveCandidatesByPlane('above')
  const renderable: readonly CanvasItem[] = useMemo(() => {
    if (!flattenHidesCommitted || plane === 'annotation') return planeItems
    const candidates = plane === 'below' ? liveBelow : liveAbove
    if (candidates.length === 0) return EMPTY_ITEMS
    return candidates.filter(
      (item) => item.type === 'space' || liveGifIds.has(item.id),
    )
  }, [flattenHidesCommitted, plane, planeItems, liveBelow, liveAbove, liveGifIds])

  // Overlay stickies are typically a small subset of all items; pull from the
  // cached sticky-only list rather than scanning every item on every render.
  const allDrawables = useDrawableSurfaces()
  const overlayDrawables: readonly StickyCanvasItem[] = useMemo(() => {
    if (plane === 'annotation' || !lockActive || !flattenReady) return EMPTY_DRAWABLES
    if (allDrawables.length === 0) return EMPTY_DRAWABLES
    return allDrawables.filter((item) =>
      stickyNeedsAnnotationOverlay(
        item,
        lockActive,
        flattenReady,
        liveGifIds,
        activeStickyId,
      ),
    )
  }, [allDrawables, plane, lockActive, flattenReady, liveGifIds, activeStickyId])

  if (renderable.length === 0 && overlayDrawables.length === 0) return null

  const ariaLabel =
    plane === 'below'
      ? 'Canvas items below drawing'
      : plane === 'above'
        ? 'Canvas items above drawing'
        : 'Temporary canvas annotations'

  function renderItem(item: CanvasItem) {
    const shellProps = {
      transformRef,
      onItemResizeStateChange,
    }

    if (item.type === 'sticky') {
      return <StickyNote key={item.id} item={item} {...shellProps} />
    }
    if (item.type === 'text') {
      return <TextItem key={item.id} item={item} {...shellProps} />
    }
    if (item.type === 'image') {
      if (isImageInSticky(item)) return null
      return <ImageItem key={item.id} item={item} {...shellProps} />
    }
    if (item.type === 'space') {
      return (
        <SpaceItem
          key={item.id}
          item={item}
          transformRef={transformRef}
          onItemResizeStateChange={onItemResizeStateChange}
        />
      )
    }
    if (item.type === 'study_hub') {
      return <StudyHubItem key={item.id} item={item} {...shellProps} />
    }
    return <VideoItem key={item.id} item={item} {...shellProps} />
  }

  return (
    <>
      <div
        key={activeCanvasId}
        aria-label={ariaLabel}
        data-lock-layer={plane === 'annotation' ? 'annotation' : undefined}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }}
      >
        <AnimatePresence initial={false}>
          {renderable.map((item) => renderItem(item))}
        </AnimatePresence>
      </div>
      {overlayDrawables.map((item) => (
        <StickyAnnotationOverlay key={`${item.id}-annotation`} item={item} />
      ))}
    </>
  )
}

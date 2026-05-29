import { useMemo, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { useCanvasItemsStore } from './canvasItemsStore'
import ImageItem from './ImageItem'
import { isImageInSticky, type ImageCanvasItem } from './types'

export default function StickyEmbeddedImages({
  stickyId,
  transformRef,
  onItemResizeStateChange,
  handlesPortal = null,
}: {
  stickyId: string
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  onItemResizeStateChange?: (resizing: boolean) => void
  handlesPortal?: HTMLElement | null
}) {
  const items = useCanvasItemsStore((s) => s.items)

  const sorted = useMemo(
    () =>
      items
        .filter(
          (item): item is ImageCanvasItem =>
            item.type === 'image' &&
            isImageInSticky(item) &&
            item.stickyId === stickyId,
        )
        .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id)),
    [items, stickyId],
  )

  if (sorted.length === 0) return null

  return (
    <>
      {sorted.map((image) => (
        <ImageItem
          key={image.id}
          item={image}
          embeddedInSticky
          handlesPortal={handlesPortal}
          transformRef={transformRef}
          onItemResizeStateChange={onItemResizeStateChange}
        />
      ))}
    </>
  )
}

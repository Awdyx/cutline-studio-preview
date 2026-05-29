import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useMediaBlobUrl } from '../hooks/useMediaBlobUrl'
import { mediaLoadOpacity, mediaLoadTransitionStyle } from '../components/MediaLoadPlaceholder'
import { useCanvasItemsStore, useItemSelected } from './canvasItemsStore'
import { useCanvasItemDragStore } from './canvasItemDragStore'
import { useCanvasItemResizeStore } from './canvasItemResizeStore'
import { canvasItemLiftSpring } from './canvasItemMotion'
import { stickyEmbeddedImageCssZ } from './stickyImageLayers'
import {
  embeddedImageOverflowRects,
  overflowFragmentBorderRadius,
} from './stickyImagePlacement'
import { isImageInSticky, type ImageCanvasItem } from './types'

const overflowPreviewStyle = {
  opacity: 0.42,
  filter: 'saturate(0.35) brightness(0.92) blur(1.5px)',
  pointerEvents: 'none' as const,
}

function OverflowImageFragments({
  image,
  stickyWidth,
  stickyHeight,
}: {
  image: ImageCanvasItem
  stickyWidth: number
  stickyHeight: number
}) {
  const { url, status } = useMediaBlobUrl(image.mediaId, image.id)
  const isDragging = useCanvasItemDragStore((s) => s.activeItemId === image.id)
  const isResizing = useCanvasItemResizeStore((s) => s.activeItemId === image.id)
  const parentStickyDragging = useCanvasItemDragStore(
    (s) => s.activeItemId === image.stickyId,
  )
  const lifted = (isDragging || isResizing) && !parentStickyDragging

  const rects = useMemo(
    () =>
      embeddedImageOverflowRects(image, {
        width: stickyWidth,
        height: stickyHeight,
      }),
    [image, stickyWidth, stickyHeight],
  )

  if (!url || rects.length === 0) return null

  return (
    <motion.div
      aria-hidden
      animate={{ scale: lifted ? 1.03 : 1 }}
      transition={canvasItemLiftSpring}
      style={{
        position: 'absolute',
        left: image.x,
        top: image.y,
        width: image.width,
        height: image.height,
        zIndex: stickyEmbeddedImageCssZ(image.zIndex),
        transformOrigin: 'top left',
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      {rects.map((rect, index) => (
        <div
          key={`${image.id}-${index}`}
          style={{
            position: 'absolute',
            left: rect.x - image.x,
            top: rect.y - image.y,
            width: rect.width,
            height: rect.height,
            overflow: 'hidden',
            borderRadius: overflowFragmentBorderRadius(rect, image, {
              width: stickyWidth,
              height: stickyHeight,
            }),
            ...overflowPreviewStyle,
          }}
        >
          <img
            src={url}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              left: image.x - rect.x,
              top: image.y - rect.y,
              width: image.width,
              height: image.height,
              objectFit: 'fill',
              display: 'block',
              opacity: mediaLoadOpacity(status),
              ...mediaLoadTransitionStyle(),
            }}
          />
        </div>
      ))}
    </motion.div>
  )
}

export default function StickyEmbeddedImageOverflow({
  stickyId,
  stickyWidth,
  stickyHeight,
}: {
  stickyId: string
  stickyWidth: number
  stickyHeight: number
}) {
  const items = useCanvasItemsStore((s) => s.items)
  const selectedIds = useCanvasItemsStore((s) => s.selectedIds)
  const stickySelected = useItemSelected(stickyId)

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

  const anyImageSelected = sorted.some((image) => selectedIds.includes(image.id))
  const active = stickySelected || anyImageSelected
  if (!active) return null

  const hasOverflow = sorted.some(
    (image) =>
      embeddedImageOverflowRects(image, {
        width: stickyWidth,
        height: stickyHeight,
      }).length > 0,
  )
  if (!hasOverflow) return null

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      {sorted.map((image) => (
        <OverflowImageFragments
          key={image.id}
          image={image}
          stickyWidth={stickyWidth}
          stickyHeight={stickyHeight}
        />
      ))}
    </div>
  )
}

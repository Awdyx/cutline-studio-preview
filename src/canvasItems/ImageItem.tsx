import { useLayoutEffect, useRef, type RefObject } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  MediaBlobFrame,
  mediaLoadOpacity,
} from '../components/MediaLoadPlaceholder'
import { useCanvasCustomizeItemHandoff } from '../canvasItemCustomize/canvasCustomizeStore'
import { useMediaBlobUrl } from '../hooks/useMediaBlobUrl'
import CanvasItemShell from './CanvasItemShell'
import { isImageInSticky } from './types'
import { useCanvasItemDragStore } from './canvasItemDragStore'
import { useCanvasItemResizeStore } from './canvasItemResizeStore'
import {
  canvasItemMediaSwapEnter,
  canvasItemMediaSwapEnterTransition,
} from './canvasItemMotion'
import { useItemMediaSwapPulse } from './canvasItemsStore'
import { MEDIA_SATURATE, type ImageCanvasItem } from './types'

const LOAD_FADE_MS = 280

export default function ImageItem({
  item,
  transformRef,
  onItemResizeStateChange,
  embeddedInSticky = false,
  handlesPortal = null,
}: {
  item: ImageCanvasItem
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  onItemResizeStateChange?: (resizing: boolean) => void
  /** Rendered inside the sticky shell — inherits sticky drag/resize transforms. */
  embeddedInSticky?: boolean
  handlesPortal?: HTMLElement | null
}) {
  const { url, status } = useMediaBlobUrl(item.mediaId, item.id)
  const swapPulse = useItemMediaSwapPulse(item.id)
  const seenSwapNonceRef = useRef(0)
  const swapEnterRef = useRef(false)
  const reduceMotion = useReducedMotion()
  const stickyHandoffId =
    embeddedInSticky && isImageInSticky(item) ? item.stickyId : ''
  const stickyHandoffActive = useCanvasCustomizeItemHandoff(stickyHandoffId)
  const stickyCustomizeHandoff = stickyHandoffId !== '' && stickyHandoffActive
  const isResizing = useCanvasItemResizeStore((s) => s.activeItemId === item.id)
  const isDragging = useCanvasItemDragStore((s) => s.activeItemId === item.id)
  const perfDrag = isDragging || isResizing
  const imageOpacity = url ? 1 : mediaLoadOpacity(status)
  const suppressLoadFade = stickyCustomizeHandoff || Boolean(url)

  swapEnterRef.current = false
  if (
    swapPulse &&
    swapPulse.nonce > seenSwapNonceRef.current &&
    !reduceMotion
  ) {
    swapEnterRef.current = true
  }

  useLayoutEffect(() => {
    if (!swapPulse || swapPulse.nonce <= seenSwapNonceRef.current) return
    seenSwapNonceRef.current = swapPulse.nonce
  }, [swapPulse])

  const shouldSwapEnter = swapEnterRef.current

  return (
    <CanvasItemShell
      item={item}
      transformRef={transformRef}
      onItemResizeStateChange={onItemResizeStateChange}
      embeddedInSticky={embeddedInSticky}
      handlesPortal={handlesPortal}
    >
      <MediaBlobFrame status={status}>
        {url ? (
          <motion.img
            key={item.mediaId}
            src={url}
            alt=""
            draggable={false}
            className="media-item-surface"
            initial={shouldSwapEnter ? canvasItemMediaSwapEnter : false}
            animate={{
              opacity: imageOpacity,
              scale: 1,
            }}
            transition={
              shouldSwapEnter
                ? canvasItemMediaSwapEnterTransition
                : suppressLoadFade
                  ? undefined
                  : { opacity: { duration: LOAD_FADE_MS / 1000, ease: 'easeOut' } }
            }
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'fill',
              display: 'block',
              filter: `saturate(${MEDIA_SATURATE})`,
              willChange: perfDrag ? 'transform' : undefined,
            }}
          />
        ) : null}
      </MediaBlobFrame>
    </CanvasItemShell>
  )
}

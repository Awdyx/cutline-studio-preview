import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  MediaBlobFrame,
  mediaLoadOpacity,
  mediaLoadTransitionStyle,
} from '../components/MediaLoadPlaceholder'
import { useMediaBlobUrl } from '../hooks/useMediaBlobUrl'
import CanvasItemShell from './CanvasItemShell'
import { MEDIA_SATURATE, type ImageCanvasItem } from './types'

export default function ImageItem({
  item,
  transformRef,
  onItemResizeStateChange,
}: {
  item: ImageCanvasItem
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  onItemResizeStateChange?: (resizing: boolean) => void
}) {
  const { url, status } = useMediaBlobUrl(item.mediaId, item.id)

  return (
    <CanvasItemShell
      item={item}
      transformRef={transformRef}
      onItemResizeStateChange={onItemResizeStateChange}
    >
      <MediaBlobFrame status={status}>
        {url ? (
          <img
            src={url}
            alt=""
            draggable={false}
            className="media-item-surface"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'fill',
              display: 'block',
              filter: `saturate(${MEDIA_SATURATE})`,
              opacity: mediaLoadOpacity(status),
              willChange: 'transform',
              ...mediaLoadTransitionStyle(),
            }}
          />
        ) : null}
      </MediaBlobFrame>
    </CanvasItemShell>
  )
}

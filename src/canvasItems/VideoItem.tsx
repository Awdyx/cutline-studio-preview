import { useState, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  MediaBlobFrame,
  mediaLoadOpacity,
  mediaLoadTransitionStyle,
} from '../components/MediaLoadPlaceholder'
import { useMediaBlobUrl } from '../hooks/useMediaBlobUrl'
import CanvasItemShell from './CanvasItemShell'
import { MEDIA_SATURATE, type VideoCanvasItem } from './types'

export default function VideoItem({
  item,
  transformRef,
  onItemResizeStateChange,
  liftZIndex,
}: {
  item: VideoCanvasItem
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  onItemResizeStateChange?: (resizing: boolean) => void
  liftZIndex?: number
}) {
  const [hovered, setHovered] = useState(false)
  const { url, status } = useMediaBlobUrl(item.mediaId, item.id)

  return (
    <CanvasItemShell
      item={item}
      transformRef={transformRef}
      onItemResizeStateChange={onItemResizeStateChange}
      liftZIndex={liftZIndex}
    >
      <MediaBlobFrame status={status}>
        {url ? (
          <video
            src={url}
            autoPlay
            muted
            loop
            playsInline
            controls={hovered}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="media-item-surface"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'fill',
              display: 'block',
              filter: `saturate(${MEDIA_SATURATE})`,
              opacity: mediaLoadOpacity(status),
              ...mediaLoadTransitionStyle(),
            }}
          />
        ) : null}
      </MediaBlobFrame>
    </CanvasItemShell>
  )
}

import { useMediaBlobUrl } from '../hooks/useMediaBlobUrl'
import { mediaLoadOpacity } from '../components/MediaLoadPlaceholder'

export function PreviewMediaImage({
  mediaId,
  x,
  y,
  width,
  height,
  opacity = 1,
}: {
  mediaId: string
  x: number
  y: number
  width: number
  height: number
  opacity?: number
}) {
  const { url, status } = useMediaBlobUrl(mediaId, mediaId)
  if (!url) return null
  return (
    <image
      href={url}
      x={x}
      y={y}
      width={width}
      height={height}
      preserveAspectRatio="xMidYMid slice"
      opacity={opacity * mediaLoadOpacity(status)}
    />
  )
}

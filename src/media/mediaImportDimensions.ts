import { fitMediaDisplayDimensions } from '../canvasItems/mediaUtils'
import type { CanvasItem, ImageCanvasItem, VideoCanvasItem } from '../canvasItems/types'
import { getMediaBlob } from './mediaBlobStore'

function loadVideoMeta(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => resolve(video)
    video.onerror = reject
    video.src = src
  })
}

export async function resolveMediaImportDimensions(
  mediaId: string,
  kind: 'image' | 'video',
): Promise<{ width: number; height: number } | null> {
  const blob = await getMediaBlob(mediaId)
  if (!blob) return null

  if (kind === 'video') {
    const url = URL.createObjectURL(blob)
    try {
      const video = await loadVideoMeta(url)
      return fitMediaDisplayDimensions(
        video.videoWidth || 320,
        video.videoHeight || 240,
      )
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  const bitmap = await createImageBitmap(blob)
  try {
    return fitMediaDisplayDimensions(bitmap.width, bitmap.height)
  } finally {
    bitmap.close()
  }
}

export function mediaItemHasImportDimensions(
  item: ImageCanvasItem | VideoCanvasItem,
): boolean {
  return (
    typeof item.importWidth === 'number' &&
    typeof item.importHeight === 'number' &&
    item.importWidth > 0 &&
    item.importHeight > 0
  )
}

export function mediaItemNeedsImportDimensionBackfill(item: CanvasItem): boolean {
  return (
    (item.type === 'image' || item.type === 'video') &&
    !mediaItemHasImportDimensions(item)
  )
}

export async function backfillMediaItemImportDimensions(
  item: CanvasItem,
): Promise<CanvasItem> {
  if (item.type !== 'image' && item.type !== 'video') return item
  if (mediaItemHasImportDimensions(item)) return item

  const dims = await resolveMediaImportDimensions(item.mediaId, item.type)
  if (!dims) {
    return {
      ...item,
      importWidth: item.width,
      importHeight: item.height,
    }
  }

  return {
    ...item,
    importWidth: dims.width,
    importHeight: dims.height,
  }
}

export async function backfillCanvasItemsImportDimensions(
  items: CanvasItem[],
): Promise<CanvasItem[]> {
  return Promise.all(items.map(backfillMediaItemImportDimensions))
}

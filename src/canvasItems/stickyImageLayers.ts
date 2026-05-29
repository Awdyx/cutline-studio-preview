import type { CanvasItem, ImageCanvasItem } from './types'
import { isImageInSticky } from './types'

/** Fixed CSS z-index for sticky note text inside the sticky face. */
export const STICKY_TEXT_CSS_Z = 1

/** Embedded image zIndex at or above this renders in front of the text layer. */
export const STICKY_EMBED_ABOVE_TEXT_MIN = 10

export function isStickyEmbedAboveText(zIndex: number): boolean {
  return zIndex >= STICKY_EMBED_ABOVE_TEXT_MIN
}

/** Map sticky-local embed zIndex to CSS z-index inside the sticky face. */
export function stickyEmbeddedImageCssZ(zIndex: number): number {
  if (!isStickyEmbedAboveText(zIndex)) return 0
  return zIndex - STICKY_EMBED_ABOVE_TEXT_MIN + STICKY_TEXT_CSS_Z + 1
}

export function embeddedImagesInSticky(
  items: readonly CanvasItem[],
  stickyId: string,
): ImageCanvasItem[] {
  return items.filter(
    (item): item is ImageCanvasItem =>
      item.type === 'image' && isImageInSticky(item) && item.stickyId === stickyId,
  )
}

export function zIndexForBringToFrontInSticky(
  items: readonly CanvasItem[],
  id: string,
): number {
  const item = items.find((entry) => entry.id === id)
  if (!item || !isImageInSticky(item)) return item?.zIndex ?? 0

  const siblings = embeddedImagesInSticky(items, item.stickyId).filter(
    (entry) => entry.id !== id,
  )

  if (!isStickyEmbedAboveText(item.zIndex)) {
    const above = siblings.filter((entry) => isStickyEmbedAboveText(entry.zIndex))
    if (above.length === 0) return STICKY_EMBED_ABOVE_TEXT_MIN
    return Math.max(...above.map((entry) => entry.zIndex)) + 1
  }

  const above = siblings.filter((entry) => isStickyEmbedAboveText(entry.zIndex))
  const maxAbove = Math.max(
    ...above.map((entry) => entry.zIndex),
    STICKY_EMBED_ABOVE_TEXT_MIN - 1,
  )
  return maxAbove + 1
}

export function zIndexForSendToBackInSticky(
  items: readonly CanvasItem[],
  id: string,
): number {
  const item = items.find((entry) => entry.id === id)
  if (!item || !isImageInSticky(item)) return item?.zIndex ?? 0

  const siblings = embeddedImagesInSticky(items, item.stickyId).filter(
    (entry) => entry.id !== id,
  )

  if (isStickyEmbedAboveText(item.zIndex)) {
    const above = siblings.filter((entry) => isStickyEmbedAboveText(entry.zIndex))
    if (above.length > 0) {
      const minAbove = Math.min(...above.map((entry) => entry.zIndex), item.zIndex)
      if (item.zIndex > minAbove) return item.zIndex - 1
    }

    const behind = siblings.filter((entry) => !isStickyEmbedAboveText(entry.zIndex))
    if (behind.length === 0) return 0
    return Math.max(...behind.map((entry) => entry.zIndex)) + 1
  }

  const behind = siblings.filter((entry) => !isStickyEmbedAboveText(entry.zIndex))
  if (behind.length === 0) return 0
  const minBehind = Math.min(...behind.map((entry) => entry.zIndex))
  if (item.zIndex <= minBehind) return item.zIndex
  return item.zIndex - 1
}

/** Default sticky-local z when dropping an image into a sticky (behind text). */
export function nextStickyEmbedZIndexBehindText(
  items: readonly CanvasItem[],
  stickyId: string,
): number {
  const behind = embeddedImagesInSticky(items, stickyId).filter(
    (entry) => !isStickyEmbedAboveText(entry.zIndex),
  )
  if (behind.length === 0) return 0
  return Math.max(...behind.map((entry) => entry.zIndex)) + 1
}

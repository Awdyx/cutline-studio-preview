import { findHistoryMediaSrc } from '../canvasHistory/canvasHistory'
import type { CanvasItem } from '../canvasItems/types'
import { buildLegacyMediaSrcIndex } from './legacyMediaSrcIndex'
import {
  getMediaBlob,
  putMediaFromDataUrl,
  restoreMediaBlobFromBackup,
  verifyMediaBlob,
} from './mediaBlobStore'

let legacySrcIndex: Map<string, string> | null = null

function legacySrcFor(mediaId: string, itemId?: string): string | null {
  if (!legacySrcIndex) legacySrcIndex = buildLegacyMediaSrcIndex()
  return (
    legacySrcIndex.get(mediaId) ??
    (itemId ? legacySrcIndex.get(itemId) : null) ??
    findHistoryMediaSrc(mediaId, itemId)
  )
}

export function resetLegacyMediaSrcIndex(): void {
  legacySrcIndex = null
}

/** Best-effort restore when the primary IndexedDB blob is missing. */
export async function tryRecoverMediaBlob(
  mediaId: string,
  itemId?: string,
): Promise<boolean> {
  if (await verifyMediaBlob(mediaId)) return true

  if (await restoreMediaBlobFromBackup(mediaId)) {
    return verifyMediaBlob(mediaId)
  }

  const src = legacySrcFor(mediaId, itemId)
  if (!src) return false

  const saved = await putMediaFromDataUrl(mediaId, src)
  if (!saved) return false

  console.info(`[media] restored blob ${mediaId} from legacy inline data`)
  return verifyMediaBlob(mediaId)
}

export async function rehydrateMissingBlobsForItems(
  items: CanvasItem[],
): Promise<number> {
  let recovered = 0
  for (const item of items) {
    if (item.type !== 'image' && item.type !== 'video') continue
    if (await verifyMediaBlob(item.mediaId)) continue
    if (await tryRecoverMediaBlob(item.mediaId, item.id)) recovered++
  }
  return recovered
}

export async function ensureMediaBlobLoaded(mediaId: string): Promise<Blob | null> {
  let blob = await getMediaBlob(mediaId)
  if (blob) return blob
  const recovered = await tryRecoverMediaBlob(mediaId)
  if (!recovered) return null
  return getMediaBlob(mediaId)
}

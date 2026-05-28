import { CANVAS_ITEMS_STORAGE_KEY } from '../canvasItems/canvasItemsPersistence'
import { WORKSPACE_STORAGE_KEY } from '../spaces/workspacePersistence'
import { isCutlineStorageKey } from '../storage/storageScope'
import { isInlineDataUrl } from './mediaKeys'

type LegacyMediaFields = {
  id?: string
  type?: string
  mediaId?: string
  src?: string
}

function indexLegacyMediaSrc(
  index: Map<string, string>,
  item: LegacyMediaFields,
): void {
  if (item.type !== 'image' && item.type !== 'video') return
  if (typeof item.src !== 'string' || !isInlineDataUrl(item.src)) return
  if (typeof item.id !== 'string') return
  if (typeof item.mediaId === 'string' && item.mediaId.length > 0) {
    index.set(item.mediaId, item.src)
  }
  index.set(item.id, item.src)
}

function walkJsonForMediaSrc(value: unknown, index: Map<string, string>): void {
  if (Array.isArray(value)) {
    for (const entry of value) walkJsonForMediaSrc(entry, index)
    return
  }
  if (!value || typeof value !== 'object') return

  const record = value as Record<string, unknown>
  indexLegacyMediaSrc(record as LegacyMediaFields, index)

  if (
    typeof record.snapshot === 'string' &&
    isInlineDataUrl(record.snapshot) &&
    typeof record.snapshotId === 'string'
  ) {
    index.set(record.snapshotId, record.snapshot)
  }

  for (const nested of Object.values(record)) {
    walkJsonForMediaSrc(nested, index)
  }
}

/** Collect inline data URLs from any cutline localStorage payload. */
export function buildLegacyMediaSrcIndex(): Map<string, string> {
  const index = new Map<string, string>()

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !isCutlineStorageKey(key)) continue
    try {
      const raw = localStorage.getItem(key)
      if (!raw || !raw.includes('data:')) continue
      walkJsonForMediaSrc(JSON.parse(raw), index)
    } catch {
      // ignore malformed payloads
    }
  }

  // Explicit keys again so dedicated legacy stores take precedence.
  for (const key of [CANVAS_ITEMS_STORAGE_KEY, WORKSPACE_STORAGE_KEY]) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      walkJsonForMediaSrc(JSON.parse(raw), index)
    } catch {
      // ignore malformed payloads
    }
  }

  return index
}

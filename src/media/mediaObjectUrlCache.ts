import { getMediaBlob, getSnapshotBlob } from './mediaBlobStore'
import { tryRecoverMediaBlob } from './tryRecoverMediaBlob'

type CacheEntry = {
  url: string
  refCount: number
}

const mediaUrls = new Map<string, CacheEntry>()
const snapshotUrls = new Map<string, CacheEntry>()

function acquire(map: Map<string, CacheEntry>, key: string, url: string): string {
  const existing = map.get(key)
  if (existing) {
    existing.refCount += 1
    return existing.url
  }
  map.set(key, { url, refCount: 1 })
  return url
}

function release(map: Map<string, CacheEntry>, key: string): void {
  const entry = map.get(key)
  if (!entry) return
  entry.refCount -= 1
  if (entry.refCount <= 0) {
    URL.revokeObjectURL(entry.url)
    map.delete(key)
  }
}

export async function resolveMediaObjectUrl(
  mediaId: string,
  itemId?: string,
): Promise<string | null> {
  const cached = mediaUrls.get(mediaId)
  if (cached) {
    cached.refCount += 1
    return cached.url
  }
  let blob = await getMediaBlob(mediaId)
  if (!blob) {
    const recovered = await tryRecoverMediaBlob(mediaId, itemId)
    if (recovered) blob = await getMediaBlob(mediaId)
  }
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  return acquire(mediaUrls, mediaId, url)
}

export function releaseMediaObjectUrl(mediaId: string): void {
  release(mediaUrls, mediaId)
}

export async function resolveSnapshotObjectUrl(spaceId: string): Promise<string | null> {
  const cached = snapshotUrls.get(spaceId)
  if (cached) {
    cached.refCount += 1
    return cached.url
  }
  const blob = await getSnapshotBlob(spaceId)
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  return acquire(snapshotUrls, spaceId, url)
}

export function releaseSnapshotObjectUrl(spaceId: string): void {
  release(snapshotUrls, spaceId)
}

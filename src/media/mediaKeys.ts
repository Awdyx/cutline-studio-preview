/** IndexedDB blob keys for canvas media and space preview snapshots. */
export function mediaBlobKey(mediaId: string): string {
  return `media:${mediaId}`
}

export function mediaBlobBackupKey(mediaId: string): string {
  return `media-backup:${mediaId}`
}

export function snapshotBlobKey(spaceId: string): string {
  return `snapshot:${spaceId}`
}

export function snapshotBlobBackupKey(spaceId: string): string {
  return `snapshot-backup:${spaceId}`
}

export function isInlineDataUrl(value: string): boolean {
  return value.startsWith('data:')
}

export function isPrimaryMediaBlobKey(key: string): boolean {
  return key.startsWith('media:') && !key.startsWith('media-backup:')
}

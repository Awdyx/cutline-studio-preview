import { createStore, del, get, keys, set } from 'idb-keyval'
import {
  isPrimaryMediaBlobKey,
  mediaBlobBackupKey,
  mediaBlobKey,
  snapshotBlobBackupKey,
  snapshotBlobKey,
} from './mediaKeys'

const blobStore = createStore('cutline-media', 'blobs')

async function readBlob(key: string): Promise<Blob | null> {
  try {
    const value = await get<Blob>(key, blobStore)
    return value instanceof Blob && value.size > 0 ? value : null
  } catch {
    return null
  }
}

async function writeBlobWithBackup(key: string, backupKey: string, blob: Blob): Promise<boolean> {
  try {
    await set(key, blob, blobStore)
  } catch (err) {
    console.warn(`[media] failed to save blob ${key}`, err)
    return false
  }

  try {
    await set(backupKey, blob, blobStore)
  } catch (err) {
    console.warn(`[media] failed to save backup blob ${backupKey}`, err)
  }

  return true
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob | null> {
  try {
    const response = await fetch(dataUrl)
    return await response.blob()
  } catch (err) {
    console.warn('[media] failed to convert data URL to blob', err)
    return null
  }
}

export async function putMediaBlob(mediaId: string, blob: Blob): Promise<boolean> {
  return writeBlobWithBackup(
    mediaBlobKey(mediaId),
    mediaBlobBackupKey(mediaId),
    blob,
  )
}

export async function putMediaFromDataUrl(
  mediaId: string,
  dataUrl: string,
): Promise<boolean> {
  const blob = await dataUrlToBlob(dataUrl)
  if (!blob) return false
  return putMediaBlob(mediaId, blob)
}

export async function getMediaBlob(mediaId: string): Promise<Blob | null> {
  const key = mediaBlobKey(mediaId)
  try {
    const primary = await readBlob(key)
    if (primary) return primary

    const backup = await readBlob(mediaBlobBackupKey(mediaId))
    if (!backup) return null

    await set(key, backup, blobStore)
    return backup
  } catch (err) {
    console.warn(`[media] failed to load media ${mediaId}`, err)
    return null
  }
}

/** Restore a missing primary blob from the backup key without touching legacy src. */
export async function restoreMediaBlobFromBackup(
  mediaId: string,
): Promise<boolean> {
  const backup = await readBlob(mediaBlobBackupKey(mediaId))
  if (!backup) return false
  try {
    await set(mediaBlobKey(mediaId), backup, blobStore)
    return true
  } catch {
    return false
  }
}

export async function deleteMediaBlob(mediaId: string): Promise<void> {
  try {
    await del(mediaBlobKey(mediaId), blobStore)
  } catch (err) {
    console.warn(`[media] failed to delete media ${mediaId}`, err)
  }
}

export async function listMediaBlobIds(): Promise<string[]> {
  try {
    const allKeys = await keys(blobStore)
    return allKeys
      .filter(
        (key): key is string =>
          typeof key === 'string' && isPrimaryMediaBlobKey(key),
      )
      .map((key) => key.slice('media:'.length))
  } catch (err) {
    console.warn('[media] failed to list media blobs', err)
    return []
  }
}

export async function copyMediaBlob(
  sourceMediaId: string,
  targetMediaId: string,
): Promise<boolean> {
  const blob = await getMediaBlob(sourceMediaId)
  if (!blob) return false
  return putMediaBlob(targetMediaId, blob)
}

export async function putSnapshotBlob(spaceId: string, blob: Blob): Promise<boolean> {
  return writeBlobWithBackup(
    snapshotBlobKey(spaceId),
    snapshotBlobBackupKey(spaceId),
    blob,
  )
}

export async function putSnapshotFromDataUrl(
  spaceId: string,
  dataUrl: string,
): Promise<boolean> {
  const blob = await dataUrlToBlob(dataUrl)
  if (!blob) return false
  return putSnapshotBlob(spaceId, blob)
}

export async function getSnapshotBlob(spaceId: string): Promise<Blob | null> {
  const key = snapshotBlobKey(spaceId)
  try {
    const primary = await readBlob(key)
    if (primary) return primary

    const backup = await readBlob(snapshotBlobBackupKey(spaceId))
    if (!backup) return null

    await set(key, backup, blobStore)
    return backup
  } catch (err) {
    console.warn(`[media] failed to load snapshot ${spaceId}`, err)
    return null
  }
}

export async function deleteSnapshotBlob(spaceId: string): Promise<void> {
  try {
    await del(snapshotBlobKey(spaceId), blobStore)
  } catch (err) {
    console.warn(`[media] failed to delete snapshot ${spaceId}`, err)
  }
}

/** Verify a blob was written and can be read back. */
export async function verifyMediaBlob(mediaId: string): Promise<boolean> {
  const blob = await getMediaBlob(mediaId)
  return blob !== null && blob.size > 0
}

export async function verifySnapshotBlob(spaceId: string): Promise<boolean> {
  const blob = await getSnapshotBlob(spaceId)
  return blob !== null && blob.size > 0
}

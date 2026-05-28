import { del, get, keys, set } from 'idb-keyval'
import { mediaBlobStore } from '../media/mediaBlobStore'
import { isCutlineStorageKey } from '../storage/storageScope'
import {
  loadProfileAvatar,
  loadProfileBanner,
  saveProfileAvatar,
  saveProfileBanner,
} from '../profile/profileAvatarPersistence'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'

export const CUTLINE_BACKUP_FORMAT_VERSION = 1

export type SerializedBlob = {
  mimeType: string
  base64: string
}

export type CutlineBackupFile = {
  formatVersion: typeof CUTLINE_BACKUP_FORMAT_VERSION
  exportedAt: string
  localStorage: Record<string, string>
  mediaBlobs: Record<string, SerializedBlob>
  profileImages: {
    avatar: string | null
    banner: string | null
  }
}

function collectCutlineLocalStorage(): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !isCutlineStorageKey(key)) continue
    const value = localStorage.getItem(key)
    if (value !== null) out[key] = value
  }
  return out
}

async function blobToSerialized(blob: Blob): Promise<SerializedBlob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(blob)
  })
  const comma = dataUrl.indexOf(',')
  const header = dataUrl.slice(0, comma)
  const mimeMatch = /^data:([^;]+)/.exec(header)
  return {
    mimeType: mimeMatch?.[1] ?? (blob.type || 'application/octet-stream'),
    base64: dataUrl.slice(comma + 1),
  }
}

function serializedToBlob(entry: SerializedBlob): Blob {
  const binary = atob(entry.base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: entry.mimeType })
}

async function readAllMediaBlobs(): Promise<Record<string, SerializedBlob>> {
  const out: Record<string, SerializedBlob> = {}
  try {
    const allKeys = await keys(mediaBlobStore)
    for (const key of allKeys) {
      if (typeof key !== 'string') continue
      const blob = await get<Blob>(key, mediaBlobStore)
      if (!(blob instanceof Blob) || blob.size === 0) continue
      out[key] = await blobToSerialized(blob)
    }
  } catch (err) {
    console.warn('[backup] failed to read media blobs', err)
  }
  return out
}

async function writeAllMediaBlobs(
  entries: Record<string, SerializedBlob>,
): Promise<void> {
  try {
    const existing = await keys(mediaBlobStore)
    for (const key of existing) {
      if (typeof key === 'string') await del(key, mediaBlobStore)
    }
    for (const [key, serialized] of Object.entries(entries)) {
      await set(key, serializedToBlob(serialized), mediaBlobStore)
    }
  } catch (err) {
    console.warn('[backup] failed to write media blobs', err)
    throw err
  }
}

function isCutlineBackupFile(value: unknown): value is CutlineBackupFile {
  if (!value || typeof value !== 'object') return false
  const o = value as CutlineBackupFile
  return (
    o.formatVersion === CUTLINE_BACKUP_FORMAT_VERSION &&
    typeof o.exportedAt === 'string' &&
    o.localStorage !== null &&
    typeof o.localStorage === 'object' &&
    o.mediaBlobs !== null &&
    typeof o.mediaBlobs === 'object' &&
    o.profileImages !== null &&
    typeof o.profileImages === 'object'
  )
}

/** Snapshot canvas, settings, media blobs, and profile images into a downloadable JSON file. */
export async function exportCutlineBackup(): Promise<CutlineBackupFile> {
  useCanvasWorkspaceStore.getState().flushPersistWorkspace()

  const [mediaBlobs, avatar, banner] = await Promise.all([
    readAllMediaBlobs(),
    loadProfileAvatar(),
    loadProfileBanner(),
  ])

  return {
    formatVersion: CUTLINE_BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    localStorage: collectCutlineLocalStorage(),
    mediaBlobs,
    profileImages: { avatar, banner },
  }
}

export function downloadCutlineBackupFile(backup: CutlineBackupFile): void {
  const stamp = backup.exportedAt.slice(0, 10)
  const blob = new Blob([JSON.stringify(backup)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `cutline-studio-backup-${stamp}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function parseCutlineBackupFile(
  file: File,
): Promise<CutlineBackupFile> {
  const text = await file.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('invalid_json')
  }
  if (!isCutlineBackupFile(parsed)) {
    throw new Error('invalid_format')
  }
  return parsed
}

/** Replace local storage and IndexedDB, then reload so all stores rehydrate. */
export async function importCutlineBackup(backup: CutlineBackupFile): Promise<void> {
  useCanvasWorkspaceStore.getState().flushPersistWorkspace()

  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (key && isCutlineStorageKey(key)) {
      localStorage.removeItem(key)
    }
  }

  for (const [key, value] of Object.entries(backup.localStorage)) {
    if (!isCutlineStorageKey(key)) continue
    if (typeof value !== 'string') continue
    localStorage.setItem(key, value)
  }

  await writeAllMediaBlobs(backup.mediaBlobs)
  await saveProfileAvatar(backup.profileImages.avatar)
  await saveProfileBanner(backup.profileImages.banner)

  window.location.reload()
}

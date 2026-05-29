import {
  compressImageForImport,
} from '../media/compressImage'
import { shouldSkipImageCompression } from '../media/imageCompressCore'
import { putMediaBlob } from '../media/mediaBlobStore'
import { STUDIO_SPAWN_SIZE_SCALE } from './types'

export const MAX_MEDIA_BYTES = 5 * 1024 * 1024
/** Longest edge for imported images/videos on canvas — scaled with studio spawn footprint. */
export const MAX_MEDIA_DIMENSION = Math.round(400 * STUDIO_SPAWN_SIZE_SCALE)

export type PreparedMedia = {
  kind: 'image' | 'video'
  blob: Blob
  width: number
  height: number
}

export type PrepareMediaFailure = 'too_large' | 'unsupported' | 'processing_failed'

export type PrepareMediaResult =
  | { ok: true; media: PreparedMedia }
  | { ok: false; reason: PrepareMediaFailure; fileSize?: number }

export function isAcceptedMediaFile(file: File): boolean {
  return file.type.startsWith('image/') || file.type.startsWith('video/')
}

export function isMediaFileTooLarge(file: File): boolean {
  return file.size > MAX_MEDIA_BYTES
}

function fitDimensions(
  naturalWidth: number,
  naturalHeight: number,
): { width: number; height: number } {
  const max = MAX_MEDIA_DIMENSION
  if (naturalWidth <= max && naturalHeight <= max) {
    return { width: naturalWidth, height: naturalHeight }
  }
  const scale = max / Math.max(naturalWidth, naturalHeight)
  return {
    width: Math.round(naturalWidth * scale),
    height: Math.round(naturalHeight * scale),
  }
}

export function fitMediaDisplayDimensions(
  naturalWidth: number,
  naturalHeight: number,
): { width: number; height: number } {
  return fitDimensions(naturalWidth, naturalHeight)
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadVideoMeta(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => resolve(video)
    video.onerror = reject
    video.src = src
  })
}

/** Read dimensions and return the original bytes — no re-encode (matches GIF import speed). */
export async function prepareImageForImmediateDisplay(
  file: File,
): Promise<{ blob: Blob; width: number; height: number } | null> {
  if (!file.type.startsWith('image/')) return null

  const buffer = await file.arrayBuffer()
  const mimeType = file.type || 'application/octet-stream'
  const bitmap = await createImageBitmap(new Blob([buffer], { type: mimeType }))

  try {
    const { width, height } = fitDimensions(bitmap.width, bitmap.height)
    return {
      blob: new Blob([buffer], { type: mimeType }),
      width,
      height,
    }
  } finally {
    bitmap.close()
  }
}

export function shouldCompressImageAfterImport(mimeType: string): boolean {
  return !shouldSkipImageCompression(mimeType)
}

export function scheduleImageImportCompression(
  mediaId: string,
  file: File,
): void {
  void (async () => {
    try {
      const compressed = await compressImageForImport(file)
      await putMediaBlob(mediaId, compressed.blob)
    } catch (err) {
      console.warn('[canvas] background image compression failed', err)
    }
  })()
}

async function prepareImageFromFile(
  file: File,
  options?: { preferMainThread?: boolean },
): Promise<{ blob: Blob; width: number; height: number } | null> {
  if (!file.type.startsWith('image/')) return null

  const compressed = await compressImageForImport(file, options)
  const { width, height } = fitDimensions(
    compressed.naturalWidth,
    compressed.naturalHeight,
  )
  return { blob: compressed.blob, width, height }
}

async function prepareVideoFromFile(
  file: File,
): Promise<{ blob: Blob; width: number; height: number } | null> {
  if (!file.type.startsWith('video/')) return null

  const dataUrl = await readFileAsDataUrl(file)
  const video = await loadVideoMeta(dataUrl)
  const { width, height } = fitDimensions(
    video.videoWidth || 320,
    video.videoHeight || 240,
  )
  const blob = await fetch(dataUrl).then((r) => r.blob())
  return { blob, width, height }
}

export async function prepareMediaFromFile(
  file: File,
  options?: { preferMainThread?: boolean },
): Promise<PrepareMediaResult> {
  if (!isAcceptedMediaFile(file)) {
    return { ok: false, reason: 'unsupported' }
  }

  if (isMediaFileTooLarge(file)) {
    return { ok: false, reason: 'too_large', fileSize: file.size }
  }

  try {
    if (file.type.startsWith('video/')) {
      const video = await prepareVideoFromFile(file)
      if (!video) return { ok: false, reason: 'processing_failed' }
      return { ok: true, media: { kind: 'video', ...video } }
    }

    const image = await prepareImageFromFile(file, options)
    if (!image) return { ok: false, reason: 'processing_failed' }
    return { ok: true, media: { kind: 'image', ...image } }
  } catch (err) {
    console.warn('[canvas] failed to prepare media import', err)
    return { ok: false, reason: 'processing_failed' }
  }
}

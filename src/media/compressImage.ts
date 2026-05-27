import {
  compressImageBitmap,
  resolveImportCompressFormat,
  shouldSkipImageCompression,
  type CompressOutputFormat,
} from './imageCompressCore'

export type CompressedImage = {
  blob: Blob
  naturalWidth: number
  naturalHeight: number
}

let webpSupported: boolean | null = null
let webpSupportPromise: Promise<boolean> | null = null

const WEBP_DETECT_TIMEOUT_MS = 2_000
const WORKER_COMPRESS_TIMEOUT_MS = 20_000

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      globalThis.setTimeout(() => reject(new Error(message)), ms)
    }),
  ])
}

async function detectWebpSupport(): Promise<boolean> {
  if (typeof document === 'undefined') return false

  return withTimeout(
    new Promise<boolean>((resolve) => {
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      canvas.toBlob(
        (blob) => resolve(blob?.type === 'image/webp'),
        'image/webp',
        0.85,
      )
    }),
    WEBP_DETECT_TIMEOUT_MS,
    'WebP support detection timed out',
  ).catch(() => false)
}

export async function getImportImageFormat(): Promise<CompressOutputFormat> {
  if (webpSupported !== null) {
    return webpSupported ? 'webp' : 'jpeg'
  }
  if (!webpSupportPromise) {
    webpSupportPromise = detectWebpSupport().then((supported) => {
      webpSupported = supported
      return supported
    })
  }
  const supported = await webpSupportPromise
  return supported ? 'webp' : 'jpeg'
}

async function readImageDimensions(
  buffer: ArrayBuffer,
  mimeType: string,
): Promise<{ naturalWidth: number; naturalHeight: number }> {
  const blob = new Blob([buffer], { type: mimeType })
  const bitmap = await createImageBitmap(blob)
  try {
    return { naturalWidth: bitmap.width, naturalHeight: bitmap.height }
  } finally {
    bitmap.close()
  }
}

async function compressImageBuffer(
  buffer: ArrayBuffer,
  mimeType: string,
  format: CompressOutputFormat,
  originalSize: number,
): Promise<CompressedImage> {
  const blob = new Blob([buffer], { type: mimeType })
  const bitmap = await createImageBitmap(blob)

  try {
    const naturalWidth = bitmap.width
    const naturalHeight = bitmap.height
    const compressed = await compressImageBitmap(bitmap, format)

    if (!compressed || compressed.size >= originalSize) {
      return { blob: new Blob([buffer], { type: mimeType }), naturalWidth, naturalHeight }
    }

    return {
      blob: compressed,
      naturalWidth,
      naturalHeight,
    }
  } finally {
    bitmap.close()
  }
}

let worker: Worker | null = null
let workerJobId = 0
const workerPending = new Map<
  number,
  {
    resolve: (value: CompressedImage) => void
    reject: (reason: unknown) => void
  }
>()

function resetWorker() {
  for (const pending of workerPending.values()) {
    pending.reject(new Error('Image compression worker reset'))
  }
  workerPending.clear()
  worker?.terminate()
  worker = null
}

function getCompressWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./compressImage.worker.ts', import.meta.url), {
      type: 'module',
    })

    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as
        | {
            id: number
            buffer: ArrayBuffer
            mimeType: string
            naturalWidth: number
            naturalHeight: number
          }
        | { id: number; error: string }

      const pending = workerPending.get(data.id)
      if (!pending) return
      workerPending.delete(data.id)

      if ('error' in data) {
        pending.reject(new Error(data.error))
        return
      }

      pending.resolve({
        blob: new Blob([data.buffer], { type: data.mimeType }),
        naturalWidth: data.naturalWidth,
        naturalHeight: data.naturalHeight,
      })
    }

    worker.onerror = (event) => {
      for (const pending of workerPending.values()) {
        pending.reject(event.error ?? new Error('Image compression worker failed'))
      }
      workerPending.clear()
      resetWorker()
    }
  }

  return worker
}

function compressViaWorker(
  buffer: ArrayBuffer,
  mimeType: string,
  format: CompressOutputFormat,
  originalSize: number,
): Promise<CompressedImage> {
  const id = ++workerJobId
  const compressWorker = getCompressWorker()

  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined

  const job = new Promise<CompressedImage>((resolve, reject) => {
    workerPending.set(id, {
      resolve: (value) => {
        if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId)
        resolve(value)
      },
      reject: (reason) => {
        if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId)
        reject(reason)
      },
    })

    timeoutId = globalThis.setTimeout(() => {
      if (!workerPending.has(id)) return
      resetWorker()
    }, WORKER_COMPRESS_TIMEOUT_MS)

    compressWorker.postMessage({
      id,
      buffer,
      mimeType,
      format,
      originalSize,
    })
  })

  return job
}

export async function compressImageForImport(
  file: File,
  options?: { preferMainThread?: boolean },
): Promise<CompressedImage> {
  const buffer = await file.arrayBuffer()
  const mimeType = file.type || 'application/octet-stream'

  if (shouldSkipImageCompression(mimeType)) {
    const { naturalWidth, naturalHeight } = await readImageDimensions(buffer, mimeType)
    return {
      blob: new Blob([buffer], { type: mimeType }),
      naturalWidth,
      naturalHeight,
    }
  }

  const webpSupported = (await getImportImageFormat()) === 'webp'
  const format = resolveImportCompressFormat(mimeType, webpSupported)

  if (format === 'original') {
    const { naturalWidth, naturalHeight } = await readImageDimensions(buffer, mimeType)
    return {
      blob: new Blob([buffer], { type: mimeType }),
      naturalWidth,
      naturalHeight,
    }
  }

  if (!options?.preferMainThread && typeof Worker !== 'undefined') {
    try {
      return await compressViaWorker(buffer, mimeType, format, file.size)
    } catch (err) {
      console.warn('[media] worker compression failed, falling back to main thread', err)
      resetWorker()
    }
  }

  return compressImageBuffer(buffer, mimeType, format, file.size)
}

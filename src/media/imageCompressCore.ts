export const IMPORT_MAX_DIMENSION = 2048
export const IMPORT_WEBP_QUALITY = 0.85
export const IMPORT_JPEG_QUALITY = 0.85

export type CompressOutputFormat = 'webp' | 'jpeg'

type CanvasLike = OffscreenCanvas | HTMLCanvasElement

export function scaledDimensions(
  naturalWidth: number,
  naturalHeight: number,
  maxDimension: number,
): { width: number; height: number } {
  if (naturalWidth <= maxDimension && naturalHeight <= maxDimension) {
    return { width: naturalWidth, height: naturalHeight }
  }
  const scale = maxDimension / Math.max(naturalWidth, naturalHeight)
  return {
    width: Math.round(naturalWidth * scale),
    height: Math.round(naturalHeight * scale),
  }
}

export function outputMimeType(format: CompressOutputFormat): string {
  return format === 'webp' ? 'image/webp' : 'image/jpeg'
}

async function encodeCanvas(
  canvas: CanvasLike,
  format: CompressOutputFormat,
): Promise<Blob | null> {
  const quality =
    format === 'webp' ? IMPORT_WEBP_QUALITY : IMPORT_JPEG_QUALITY
  const type = outputMimeType(format)

  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type, quality })
  }

  return new Promise((resolve) => {
    ;(canvas as HTMLCanvasElement).toBlob(
      (blob) => resolve(blob),
      type,
      quality,
    )
  })
}

function createCanvas(width: number, height: number): CanvasLike {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height)
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export async function compressImageBitmap(
  bitmap: ImageBitmap,
  format: CompressOutputFormat,
  maxDimension: number = IMPORT_MAX_DIMENSION,
): Promise<Blob | null> {
  const { width, height } = scaledDimensions(
    bitmap.width,
    bitmap.height,
    maxDimension,
  )

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d', { alpha: true }) as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null
  if (!ctx) return null

  ctx.drawImage(bitmap, 0, 0, width, height)
  return encodeCanvas(canvas, format)
}

export function shouldSkipImageCompression(mimeType: string): boolean {
  return mimeType === 'image/gif' || mimeType === 'image/svg+xml'
}

export function mimeTypePreservesAlpha(mimeType: string): boolean {
  return mimeType === 'image/png' || mimeType === 'image/webp'
}

export function resolveImportCompressFormat(
  mimeType: string,
  webpSupported: boolean,
): CompressOutputFormat | 'original' {
  if (mimeTypePreservesAlpha(mimeType)) {
    return webpSupported ? 'webp' : 'original'
  }
  return webpSupported ? 'webp' : 'jpeg'
}

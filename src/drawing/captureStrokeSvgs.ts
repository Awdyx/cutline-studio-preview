const RASTER_MIME = 'image/webp'
const RASTER_QUALITY = 0.92

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

function rasterizeSvgElement(svg: SVGSVGElement): Promise<string | null> {
  const width = svg.width.baseVal.value || svg.clientWidth
  const height = svg.height.baseVal.value || svg.clientHeight
  if (width <= 0 || height <= 0) return Promise.resolve(null)

  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))

  const serialized = new XMLSerializer().serializeToString(clone)
  const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(width)
        canvas.height = Math.round(height)
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL(RASTER_MIME, RASTER_QUALITY))
      } catch {
        resolve(null)
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(null)
    }
    img.src = objectUrl
  })
}

export function findStrokeRasterTargets(root: ParentNode): SVGSVGElement[] {
  return [...root.querySelectorAll('svg.cutline-stroke-svg[data-stroke-raster-key]')].filter(
    (node): node is SVGSVGElement => node instanceof SVGSVGElement,
  )
}

export async function captureStrokeSvgBitmaps(
  root: HTMLElement,
): Promise<Record<string, string>> {
  await waitForPaint()

  const svgs = findStrokeRasterTargets(root)
  const bitmapsByKey: Record<string, string> = {}

  for (const svg of svgs) {
    const key = svg.getAttribute('data-stroke-raster-key')
    if (!key) continue
    const dataUrl = await rasterizeSvgElement(svg)
    if (dataUrl) bitmapsByKey[key] = dataUrl
  }

  return bitmapsByKey
}

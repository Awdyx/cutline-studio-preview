import {
  embeddedImageOverflowRects,
  STICKY_CLIP_RADIUS,
  STICKY_OVERFLOW_INSET_BLEED_PX,
  type StickyLocalRect,
} from './stickyImagePlacement'
import type { ImageCanvasItem, StickyCanvasItem } from './types'

const OVERFLOW_EDGE_FADE_PX = 64

type MaskStop = { pct: number; color: string }

export type OverflowMaskLayers = {
  maskImage: string
  maskComposite: string
  webkitMaskComposite: string
}

export type OverflowPreviewLayout = {
  union: StickyLocalRect
  clipPath: string
}

function overflowFadeDistance(span: number, fadePx = OVERFLOW_EDGE_FADE_PX): number {
  return Math.min(fadePx, Math.max(20, span * 0.94))
}

function pushMaskStop(stops: MaskStop[], pct: number, color: string) {
  stops.push({ pct: Math.max(0, Math.min(100, pct)), color })
}

function finalizeAxisMask(stops: MaskStop[], direction: 'to right' | 'to bottom'): string {
  if (stops.length === 0) {
    return `linear-gradient(${direction}, black, black)`
  }

  stops.sort((a, b) => a.pct - b.pct)

  const deduped: MaskStop[] = []
  for (const stop of stops) {
    const last = deduped[deduped.length - 1]
    if (last && Math.abs(last.pct - stop.pct) < 0.5) {
      last.color = stop.color
      continue
    }
    deduped.push({ ...stop })
  }

  return `linear-gradient(${direction}, ${deduped
    .map((stop) => `${stop.color} ${Math.round(stop.pct)}%`)
    .join(', ')})`
}

function roundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): string {
  const r = Math.min(radius, width / 2, height / 2)
  if (r <= 0) {
    return `M ${x},${y} h ${width} v ${height} h ${-width} Z`
  }

  const right = x + width
  const bottom = y + height
  return [
    `M ${x + r},${y}`,
    `H ${right - r}`,
    `Q ${right},${y} ${right},${y + r}`,
    `V ${bottom - r}`,
    `Q ${right},${bottom} ${right - r},${bottom}`,
    `H ${x + r}`,
    `Q ${x},${bottom} ${x},${bottom - r}`,
    `V ${y + r}`,
    `Q ${x},${y} ${x + r},${y}`,
    'Z',
  ].join(' ')
}

/** Bounding box of all overflow strips for one embedded image. */
export function embeddedImageOverflowUnion(
  image: Pick<ImageCanvasItem, 'x' | 'y' | 'width' | 'height'>,
  sticky: Pick<StickyCanvasItem, 'width' | 'height'>,
): StickyLocalRect | null {
  const rects = embeddedImageOverflowRects(image, sticky)
  if (rects.length === 0) return null

  const x = Math.min(...rects.map((rect) => rect.x))
  const y = Math.min(...rects.map((rect) => rect.y))
  const right = Math.max(...rects.map((rect) => rect.x + rect.width))
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height))

  return { x, y, width: right - x, height: bottom - y }
}

/** Image minus sticky face (rounded, with bleed under clip) in element-local coords. */
export function buildOverflowClipPath(
  image: Pick<ImageCanvasItem, 'x' | 'y' | 'width' | 'height'>,
  sticky: Pick<StickyCanvasItem, 'width' | 'height'>,
  union: StickyLocalRect,
  bleed = STICKY_OVERFLOW_INSET_BLEED_PX,
  radius = STICKY_CLIP_RADIUS,
): string {
  const imageX = image.x - union.x
  const imageY = image.y - union.y
  const imagePath = `M ${imageX},${imageY} h ${image.width} v ${image.height} h ${-image.width} Z`

  const holeX = -bleed - union.x
  const holeY = -bleed - union.y
  const holePath = roundedRectPath(
    holeX,
    holeY,
    sticky.width + bleed * 2,
    sticky.height + bleed * 2,
    radius,
  )

  return `path(evenodd, '${imagePath} ${holePath}')`
}

function buildHorizontalDistanceMask(
  union: StickyLocalRect,
  image: Pick<ImageCanvasItem, 'x' | 'y' | 'width' | 'height'>,
  sticky: Pick<StickyCanvasItem, 'width' | 'height'>,
): string {
  const { x: ix, width: iw } = image
  const ib = ix + iw
  const sw = sticky.width
  const { x: rx, width: rw } = union
  const rectEnd = rx + rw
  const fade = overflowFadeDistance(rw)
  const toPct = (coord: number) => ((coord - rx) / rw) * 100
  const stops: MaskStop[] = []

  if (ix < 0 && rx < 0) {
    pushMaskStop(stops, toPct(Math.max(rx, ix)), 'transparent')
    pushMaskStop(stops, toPct(Math.min(rectEnd, ix + fade * 0.42)), 'rgba(0,0,0,0.28)')
    pushMaskStop(stops, toPct(Math.min(rectEnd, ix + fade)), 'black')
  }

  const plateauStart = Math.max(rx, 0)
  const plateauEnd = Math.min(rectEnd, sw)
  if (plateauStart <= plateauEnd) {
    pushMaskStop(stops, toPct(plateauStart), 'black')
    pushMaskStop(stops, toPct(plateauEnd), 'black')
  }

  if (ib > sw && rectEnd > sw) {
    pushMaskStop(stops, toPct(Math.max(rx, sw)), 'black')
    pushMaskStop(stops, toPct(Math.max(rx, ib - fade * 0.42)), 'rgba(0,0,0,0.28)')
    pushMaskStop(stops, toPct(Math.min(rectEnd, ib)), 'transparent')
  }

  return finalizeAxisMask(stops, 'to right')
}

function buildVerticalDistanceMask(
  union: StickyLocalRect,
  image: Pick<ImageCanvasItem, 'x' | 'y' | 'width' | 'height'>,
  sticky: Pick<StickyCanvasItem, 'width' | 'height'>,
): string {
  const { y: iy, height: ih } = image
  const ir = iy + ih
  const sh = sticky.height
  const { y: ry, height: rh } = union
  const rectEnd = ry + rh
  const fade = overflowFadeDistance(rh)
  const toPct = (coord: number) => ((coord - ry) / rh) * 100
  const stops: MaskStop[] = []

  if (iy < 0 && ry < 0) {
    pushMaskStop(stops, toPct(Math.max(ry, iy)), 'transparent')
    pushMaskStop(stops, toPct(Math.min(rectEnd, iy + fade * 0.42)), 'rgba(0,0,0,0.28)')
    pushMaskStop(stops, toPct(Math.min(rectEnd, iy + fade)), 'black')
  }

  const plateauStart = Math.max(ry, 0)
  const plateauEnd = Math.min(rectEnd, sh)
  if (plateauStart <= plateauEnd) {
    pushMaskStop(stops, toPct(plateauStart), 'black')
    pushMaskStop(stops, toPct(plateauEnd), 'black')
  }

  if (ir > sh && rectEnd > sh) {
    pushMaskStop(stops, toPct(Math.max(ry, sh)), 'black')
    pushMaskStop(stops, toPct(Math.max(ry, ir - fade * 0.42)), 'rgba(0,0,0,0.28)')
    pushMaskStop(stops, toPct(Math.min(rectEnd, ir)), 'transparent')
  }

  return finalizeAxisMask(stops, 'to bottom')
}

/** H×V distance falloff from sticky bounds — one mask on the union layer. */
export function buildOverflowDistanceMask(
  union: StickyLocalRect,
  image: Pick<ImageCanvasItem, 'x' | 'y' | 'width' | 'height'>,
  sticky: Pick<StickyCanvasItem, 'width' | 'height'>,
): OverflowMaskLayers {
  const horizontal = buildHorizontalDistanceMask(union, image, sticky)
  const vertical = buildVerticalDistanceMask(union, image, sticky)
  return {
    maskImage: `${horizontal}, ${vertical}`,
    maskComposite: 'intersect',
    webkitMaskComposite: 'source-in',
  }
}

export function buildOverflowPreviewLayout(
  image: Pick<ImageCanvasItem, 'x' | 'y' | 'width' | 'height'>,
  sticky: Pick<StickyCanvasItem, 'width' | 'height'>,
): OverflowPreviewLayout | null {
  const union = embeddedImageOverflowUnion(image, sticky)
  if (!union) return null

  return {
    union,
    clipPath: buildOverflowClipPath(image, sticky, union),
  }
}

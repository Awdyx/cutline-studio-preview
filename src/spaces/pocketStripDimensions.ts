import type { CanvasItem } from '../canvasItems/types'
import type { Stroke } from '../drawing/types'
import type { PocketStripState } from './types'

/** Virtual strip height — logical coords; origin y=0 sits at the midpoint. */
export const POCKET_STRIP_VIRTUAL_HEIGHT = 200_000

export const POCKET_STRIP_CENTER_Y = POCKET_STRIP_VIRTUAL_HEIGHT / 2

/** Default logical width when no viewport is available yet. */
export const POCKET_STRIP_DEFAULT_LOGICAL_WIDTH = 834

export const POCKET_STRIP_EDGE_PAD = 120

export const POCKET_STRIP_STROKE_BLEED_PAD = 240

export function pocketStripCenterY(): number {
  return POCKET_STRIP_CENTER_Y
}

export function defaultPocketStripState(viewportWidth = POCKET_STRIP_DEFAULT_LOGICAL_WIDTH): PocketStripState {
  return {
    scrollY: 0,
    logicalWidth: Math.max(320, Math.round(viewportWidth)),
  }
}

export function pocketStripVisualScale(
  logicalWidth: number,
  viewportWidth: number,
): number {
  if (logicalWidth <= 0 || viewportWidth <= 0) return 1
  return viewportWidth / logicalWidth
}

/** scrollTop (visual px) when scrollY = 0 and viewport is centered on y=0. */
export function pocketStripCenterScrollTop(
  viewportHeight: number,
  scale: number,
): number {
  return POCKET_STRIP_CENTER_Y * scale - viewportHeight / 2
}

export function pocketStripScrollTopFromScrollY(
  scrollY: number,
  viewportHeight: number,
  scale: number,
): number {
  return pocketStripCenterScrollTop(viewportHeight, scale) + scrollY * scale
}

export function pocketStripScrollYFromScrollTop(
  scrollTop: number,
  viewportHeight: number,
  scale: number,
): number {
  return (scrollTop - pocketStripCenterScrollTop(viewportHeight, scale)) / scale
}

export function pocketStripLogicalYToContentTop(y: number): number {
  return POCKET_STRIP_CENTER_Y + y
}

export function pocketStripContentTopToLogicalY(top: number): number {
  return top - POCKET_STRIP_CENTER_Y
}

export function clampPocketStripItemX(
  x: number,
  itemWidth: number,
  logicalWidth: number,
): number {
  return Math.max(0, Math.min(logicalWidth - itemWidth, x))
}

export function clampPocketStripItemY(
  y: number,
  itemHeight: number,
): number {
  const minY = -POCKET_STRIP_CENTER_Y + POCKET_STRIP_EDGE_PAD
  const maxY =
    POCKET_STRIP_VIRTUAL_HEIGHT - POCKET_STRIP_CENTER_Y - itemHeight - POCKET_STRIP_EDGE_PAD
  return Math.max(minY, Math.min(maxY, y))
}

export function pocketStripBounds(logicalWidth: number): {
  width: number
  height: number
  minY: number
  maxY: number
} {
  return {
    width: logicalWidth,
    height: POCKET_STRIP_VIRTUAL_HEIGHT,
    minY: -POCKET_STRIP_CENTER_Y + POCKET_STRIP_EDGE_PAD,
    maxY: POCKET_STRIP_CENTER_Y - POCKET_STRIP_EDGE_PAD,
  }
}

function strokePointBounds(strokes: Stroke[]): { minY: number; maxY: number } | null {
  let minY = Infinity
  let maxY = -Infinity
  for (const stroke of strokes) {
    for (const point of stroke.points) {
      minY = Math.min(minY, point.y)
      maxY = Math.max(maxY, point.y)
    }
  }
  if (!Number.isFinite(minY) || !Number.isFinite(maxY)) return null
  return { minY, maxY }
}

function itemBounds(items: CanvasItem[]): { minY: number; maxY: number } | null {
  if (items.length === 0) return null
  let minY = Infinity
  let maxY = -Infinity
  for (const item of items) {
    minY = Math.min(minY, item.y)
    maxY = Math.max(maxY, item.y + item.height)
  }
  return { minY, maxY }
}

/** Content span in logical y (center-origin). */
export function pocketStripContentSpan(
  items: CanvasItem[],
  strokes: Stroke[],
  annotationStrokes: Stroke[],
): { minY: number; maxY: number } {
  const spans = [
    itemBounds(items),
    strokePointBounds(strokes),
    strokePointBounds(annotationStrokes),
  ].filter((s): s is { minY: number; maxY: number } => s != null)

  if (spans.length === 0) {
    return { minY: -800, maxY: 800 }
  }

  return {
    minY: Math.min(...spans.map((s) => s.minY)),
    maxY: Math.max(...spans.map((s) => s.maxY)),
  }
}

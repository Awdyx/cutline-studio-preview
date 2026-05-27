import type { ToolMode } from './toolStore'

/** Screen-space pill to the left of the pencil anchor (px, zoom-independent). */
export const PILL_GAP = 10
export const PILL_HEIGHT = 44
export const PILL_PADDING = 4
export const SEGMENT_WIDTH = 48
export const PILL_WIDTH = PILL_PADDING * 2 + SEGMENT_WIDTH * 4

export const PEN_TOOL_ORDER: ToolMode[] = ['pen', 'highlighter', 'lasso', 'erase']

export function pillScreenRect(anchorX: number, anchorY: number) {
  const right = anchorX - PILL_GAP
  const left = right - PILL_WIDTH
  const top = anchorY - PILL_HEIGHT / 2
  return { left, top, right, bottom: top + PILL_HEIGHT, width: PILL_WIDTH, height: PILL_HEIGHT }
}

export function hitTestPenToolPill(
  clientX: number,
  clientY: number,
  anchorX: number,
  anchorY: number,
): ToolMode | null {
  const { left, top, right, bottom } = pillScreenRect(anchorX, anchorY)
  if (clientX < left || clientX > right || clientY < top || clientY > bottom) return null

  const innerLeft = left + PILL_PADDING
  const index = Math.floor((clientX - innerLeft) / SEGMENT_WIDTH)
  if (index < 0 || index >= PEN_TOOL_ORDER.length) return null
  return PEN_TOOL_ORDER[index] ?? null
}

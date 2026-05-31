import type { ToolMode } from './toolStore'

/** Screen-space pill to the left of the pencil anchor (px, zoom-independent). */
export const PILL_GAP = 10
export const PILL_HEIGHT = 44
export const PILL_PADDING = 4
export const SEGMENT_WIDTH = 48

export const PEN_TOOL_ORDER: ToolMode[] = ['pen', 'highlighter', 'lasso', 'erase']

/** UI customization draw tab — no lasso in the hold-to-open tool pill. */
export const UI_DRAW_PEN_TOOL_ORDER: ToolMode[] = ['pen', 'highlighter', 'erase']

export const PILL_WIDTH = pillWidthForToolOrder(PEN_TOOL_ORDER)

export function pillWidthForToolOrder(order: readonly ToolMode[]): number {
  return PILL_PADDING * 2 + SEGMENT_WIDTH * order.length
}

export function isUiDrawCanvasTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('[data-ui-draw-canvas]')
}

export function pillScreenRect(
  anchorX: number,
  anchorY: number,
  toolOrder: readonly ToolMode[] = PEN_TOOL_ORDER,
) {
  const width = pillWidthForToolOrder(toolOrder)
  const right = anchorX - PILL_GAP
  const left = right - width
  const top = anchorY - PILL_HEIGHT / 2
  return { left, top, right, bottom: top + PILL_HEIGHT, width, height: PILL_HEIGHT }
}

export type PenToolMenuRail = {
  railX: number
  lastRawX: number
}

/** Seed the pill guard rail when the menu opens. */
export function initPenToolMenuRail(
  clientX: number,
  anchorX: number,
  anchorY: number,
  toolOrder: readonly ToolMode[] = PEN_TOOL_ORDER,
): PenToolMenuRail & { x: number; y: number } {
  const { left, right } = pillScreenRect(anchorX, anchorY, toolOrder)
  const railX = Math.min(Math.max(clientX, left), right)
  return { railX, lastRawX: clientX, x: railX, y: anchorY }
}

/**
 * Move along the pill rail using pointer deltas — overshoot past an edge is
 * absorbed (wall) instead of stacking invisible travel to undo later.
 */
export function advancePenToolMenuRail(
  rail: PenToolMenuRail,
  clientX: number,
  anchorX: number,
  anchorY: number,
  toolOrder: readonly ToolMode[] = PEN_TOOL_ORDER,
): PenToolMenuRail & { x: number; y: number } {
  const { left, right } = pillScreenRect(anchorX, anchorY, toolOrder)
  const delta = clientX - rail.lastRawX
  const railX = Math.min(Math.max(rail.railX + delta, left), right)
  return { railX, lastRawX: clientX, x: railX, y: anchorY }
}

export function pillSegmentCenters(
  anchorX: number,
  anchorY: number,
  toolOrder: readonly ToolMode[] = PEN_TOOL_ORDER,
): number[] {
  const { left } = pillScreenRect(anchorX, anchorY, toolOrder)
  const innerLeft = left + PILL_PADDING
  return toolOrder.map((_, index) => innerLeft + SEGMENT_WIDTH * (index + 0.5))
}

/** Nearest segment center — discrete tool pick (no in-between blend). */
export function penToolSegmentIndex(
  clientX: number,
  anchorX: number,
  anchorY: number,
  toolOrder: readonly ToolMode[] = PEN_TOOL_ORDER,
): number {
  const centers = pillSegmentCenters(anchorX, anchorY, toolOrder)
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < centers.length; i++) {
    const dist = Math.abs(clientX - centers[i]!)
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  }
  return best
}

export const PILL_ACTIVE_SEGMENT_FLEX = 1.44
export const PILL_IDLE_SEGMENT_FLEX = 0.68

export function hitTestPenToolPill(
  clientX: number,
  clientY: number,
  anchorX: number,
  anchorY: number,
  toolOrder: readonly ToolMode[] = PEN_TOOL_ORDER,
  opts?: { guardRail?: boolean },
): ToolMode | null {
  const { left, right } = pillScreenRect(anchorX, anchorY, toolOrder)
  if (!opts?.guardRail && (clientX < left || clientX > right)) return null

  if (!opts?.guardRail) {
    const { top, bottom } = pillScreenRect(anchorX, anchorY, toolOrder)
    if (clientY < top || clientY > bottom) return null
  }

  const index = opts?.guardRail
    ? penToolSegmentIndex(clientX, anchorX, anchorY, toolOrder)
    : (() => {
        const innerLeft = left + PILL_PADDING
        return Math.floor((clientX - innerLeft) / SEGMENT_WIDTH)
      })()

  if (index < 0 || index >= toolOrder.length) return null
  return toolOrder[index] ?? null
}

/** Elastic segment weights for the pencil-hold pill — bulge near the pointer (iPad trackpad style). */
export function isPointerInPenToolPill(
  clientX: number,
  _clientY: number,
  anchorX: number,
  anchorY: number,
  toolOrder: readonly ToolMode[] = PEN_TOOL_ORDER,
  opts?: { guardRail?: boolean },
): boolean {
  if (opts?.guardRail) return true

  const { left, right, top, bottom } = pillScreenRect(anchorX, anchorY, toolOrder)
  return clientX >= left && clientX <= right && _clientY >= top && _clientY <= bottom
}

export function penToolSegmentWeights(
  clientX: number,
  _clientY: number,
  anchorX: number,
  anchorY: number,
  toolOrder: readonly ToolMode[] = PEN_TOOL_ORDER,
  opts?: { guardRail?: boolean },
): number[] {
  const count = toolOrder.length
  const equal = Array.from({ length: count }, () => 1)
  const { left, right } = pillScreenRect(anchorX, anchorY, toolOrder)

  if (!opts?.guardRail && (clientX < left || clientX > right)) return equal

  const activeIndex = penToolSegmentIndex(clientX, anchorX, anchorY, toolOrder)

  return toolOrder.map((_, index) =>
    index === activeIndex ? PILL_ACTIVE_SEGMENT_FLEX : PILL_IDLE_SEGMENT_FLEX,
  )
}

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

/** Gap between the pill row and the settings panel stacked above it (px). */
export const PILL_SETTINGS_GAP = 8

/** Matches PenFab tool-settings shell height so ToolColorPopover fits unchanged. */
export const PILL_SETTINGS_HEIGHT = 100

/** Upward travel (px) to open a tool's settings submenu — kept low for stylus flicks. */
export const PILL_SUBMENU_DRAG_UP_PX = 12

/** Extra horizontal slack while dragging up (pill is narrow). */
export const PILL_SUBMENU_HORIZONTAL_SLOP_PX = 10

/** How far above the settings panel the pointer may still count as “in the submenu”. */
export const PILL_SUBMENU_TOP_SLOP_PX = 20

/** Upper fraction of the pill that counts as part of the upward-drag corridor. */
export const PILL_SUBMENU_PILL_APPROACH_RATIO = 0.7

/** Pencil-hold pill — pen & highlighter only (lasso/eraser pick on release, no submenu). */
export type PenToolPillSettingsPanel = 'pen' | 'highlighter'

export function pillToolSupportsSettingsPanel(
  mode: ToolMode,
): mode is PenToolPillSettingsPanel {
  return mode === 'pen' || mode === 'highlighter'
}

/** Pen FAB tool-settings panels (includes lasso/eraser targets). */
export type PenToolSettingsPanel = PenToolPillSettingsPanel | 'lasso' | 'erase'

export function toolSupportsSettingsPanel(mode: ToolMode): mode is PenToolSettingsPanel {
  return pillToolSupportsSettingsPanel(mode) || mode === 'lasso' || mode === 'erase'
}

export function pillWidthForToolOrder(order: readonly ToolMode[]): number {
  return PILL_PADDING * 2 + SEGMENT_WIDTH * order.length
}

export function isUiDrawCanvasTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('[data-ui-draw-canvas]')
}

export function isPointerOverUiDrawCanvas(clientX: number, clientY: number): boolean {
  const el = document.elementFromPoint(clientX, clientY)
  return isUiDrawCanvasTarget(el)
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

export function pillSettingsPanelWidth(pillWidth: number): number {
  return pillWidth
}

export function pillSettingsScreenRect(
  anchorX: number,
  anchorY: number,
  toolOrder: readonly ToolMode[] = PEN_TOOL_ORDER,
  settingsPanel?: PenToolSettingsPanel | null,
) {
  const pill = pillScreenRect(anchorX, anchorY, toolOrder)
  const width = pillSettingsPanelWidth(pill.width)
  const right = pill.right
  const left = right - width
  const bottom = pill.top - PILL_SETTINGS_GAP
  const top = bottom - PILL_SETTINGS_HEIGHT
  return {
    left,
    top,
    right,
    bottom,
    width,
    height: PILL_SETTINGS_HEIGHT,
  }
}

export function isPointerInPenToolSettingsPanel(
  clientX: number,
  clientY: number,
  anchorX: number,
  anchorY: number,
  toolOrder: readonly ToolMode[] = PEN_TOOL_ORDER,
  settingsPanel?: PenToolSettingsPanel | null,
): boolean {
  const { left, right, top, bottom } = pillSettingsScreenRect(
    anchorX,
    anchorY,
    toolOrder,
    settingsPanel,
  )
  return clientX >= left && clientX <= right && clientY >= top && clientY <= bottom
}

/** Settings panel + gap + upper pill — forgiving corridor for open/hold gestures. */
export function isPointerInPenToolSubmenuZone(
  clientX: number,
  clientY: number,
  anchorX: number,
  anchorY: number,
  toolOrder: readonly ToolMode[] = PEN_TOOL_ORDER,
  settingsPanel?: PenToolSettingsPanel | null,
): boolean {
  const settings = pillSettingsScreenRect(anchorX, anchorY, toolOrder, settingsPanel)
  const pill = pillScreenRect(anchorX, anchorY, toolOrder)
  const left = settings.left - PILL_SUBMENU_HORIZONTAL_SLOP_PX
  const right = settings.right + PILL_SUBMENU_HORIZONTAL_SLOP_PX
  if (clientX < left || clientX > right) return false
  if (clientY < settings.top - PILL_SUBMENU_TOP_SLOP_PX) return false
  if (clientY <= settings.bottom) return true
  const approachBottom = pill.top + pill.height * PILL_SUBMENU_PILL_APPROACH_RATIO
  return clientY <= approachBottom
}

export function penToolSubmenuShouldOpen(
  peekY: number,
  clientY: number,
  inSubmenuZone: boolean,
): boolean {
  if (inSubmenuZone) return true
  return peekY - clientY >= PILL_SUBMENU_DRAG_UP_PX
}

export function isPointerInPenToolChrome(
  clientX: number,
  clientY: number,
  anchorX: number,
  anchorY: number,
  toolOrder: readonly ToolMode[] = PEN_TOOL_ORDER,
  settingsPanel?: PenToolSettingsPanel | null,
): boolean {
  const pill = pillScreenRect(anchorX, anchorY, toolOrder)
  if (
    clientX >= pill.left &&
    clientX <= pill.right &&
    clientY >= pill.top &&
    clientY <= pill.bottom
  ) {
    return true
  }
  if (settingsPanel) {
    return isPointerInPenToolSettingsPanel(
      clientX,
      clientY,
      anchorX,
      anchorY,
      toolOrder,
      settingsPanel,
    )
  }
  return false
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

/** Re-sync the guard rail to the live pointer (e.g. after a settings submenu). */
export function snapPenToolMenuRailToPointer(
  clientX: number,
  anchorX: number,
  anchorY: number,
  toolOrder: readonly ToolMode[] = PEN_TOOL_ORDER,
): PenToolMenuRail & { x: number; y: number } {
  return initPenToolMenuRail(clientX, anchorX, anchorY, toolOrder)
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

/** Pointer left the pill upward (still within pill width) — opens the settings submenu. */
export function isPointerExitingPenToolPillTop(
  clientX: number,
  clientY: number,
  anchorX: number,
  anchorY: number,
  toolOrder: readonly ToolMode[] = PEN_TOOL_ORDER,
): boolean {
  const { left, right, top } = pillScreenRect(anchorX, anchorY, toolOrder)
  return clientY < top && clientX >= left && clientX <= right
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

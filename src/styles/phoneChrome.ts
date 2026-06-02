import type { CSSProperties } from 'react'

export const PHONE_CHROME_INSET = 12

/** Tallest rendered control in the phone icon row (compact profile avatar button). */
export const PHONE_HEADER_ICONS_ROW_HEIGHT = 40

/** Gap between icon row and search row / submenu spawn. */
export const PHONE_HEADER_ROW_GAP = 16

/** Search row height. */
export const PHONE_SEARCH_ROW_HEIGHT = 44

/** Space below the two-row phone header (safe area + brand row + search row). */
export const PHONE_HEADER_BLOCK_HEIGHT =
  PHONE_HEADER_ICONS_ROW_HEIGHT + PHONE_HEADER_ROW_GAP + PHONE_SEARCH_ROW_HEIGHT

/** Compact phone dropdown width (desktop menus are ~260–360px). */
export const PHONE_MENU_MAX_WIDTH_PX = 320

export const PHONE_MENU_MIN_WIDTH_PX = 260

/** Inset MenuRow block height in top chrome menus (10+10 padding, 16px icon). */
export const PHONE_CUTLINE_MENU_ROW_HEIGHT_PX = 36

/**
 * Layout max-height for top chrome menus on phone — matches the Cutline / Settings
 * stack bottom on phone (General nav + divider + Settings). Phone Cutline omits
 * Shortcuts; scaled panels use phoneTopMenuMaxHeight(scale) so the visual bottom
 * aligns with this cap.
 */
export const PHONE_TOP_MENU_MAX_HEIGHT_PX = 316 - PHONE_CUTLINE_MENU_ROW_HEIGHT_PX

export function phoneTopMenuMaxHeight(layoutScale = 1): string {
  if (layoutScale >= 0.999) return `${PHONE_TOP_MENU_MAX_HEIGHT_PX}px`
  return `${Math.round(PHONE_TOP_MENU_MAX_HEIGHT_PX / layoutScale)}px`
}

/** @deprecated Use PHONE_TOP_MENU_MAX_HEIGHT_PX / phoneTopMenuMaxHeight() */
export const PHONE_MENU_MAX_HEIGHT = phoneTopMenuMaxHeight()

/** Visual scale for bottom FAB menus on phone (matches pen FAB ~0.94). */
export const PHONE_FAB_MENU_SCALE = 0.92

/** Visual scale for top-bar news / notifications panels on phone. */
export const PHONE_TOP_PANEL_SCALE = 0.94

/** Selected-item arrangement menu (bring to front, delete, …) on phone. */
export const PHONE_Z_ORDER_MENU_SCALE = 0.7

export type PhoneMenuAnchor = 'left' | 'right'

const phoneHeaderTop = 'max(12px, env(safe-area-inset-top, 0px))'
const phoneBottomInset = 'max(12px, env(safe-area-inset-bottom, 0px))'

/** Dead space between top icon row and dropdown menus on phone. */
export const PHONE_TOP_MENU_GAP = PHONE_HEADER_ROW_GAP

/** Top chrome menus hide the search row — panels anchor under the icon row only. */
export function phonePanelTop(): string {
  return `calc(${phoneHeaderTop} + ${PHONE_HEADER_ICONS_ROW_HEIGHT + PHONE_TOP_MENU_GAP}px)`
}

function phoneMenuWidthCap(extraInsetPx = 0): string {
  return `min(${PHONE_MENU_MAX_WIDTH_PX}px, calc(100vw - ${PHONE_CHROME_INSET * 2 + extraInsetPx}px))`
}

function phoneCompactSheetStyle(
  top: string,
  anchor: PhoneMenuAnchor,
  overrides?: CSSProperties,
  layoutScale = 1,
): CSSProperties {
  return {
    position: 'fixed',
    top,
    ...(anchor === 'left'
      ? { left: PHONE_CHROME_INSET, right: 'auto' }
      : { right: PHONE_CHROME_INSET, left: 'auto' }),
    width: 'max-content',
    minWidth: PHONE_MENU_MIN_WIDTH_PX,
    maxWidth: phoneMenuWidthCap(),
    maxHeight: phoneTopMenuMaxHeight(layoutScale),
    overflowX: 'hidden',
    overflowY: 'auto',
    ...overrides,
  }
}

/** Compact dropdown anchored below the phone header. */
export function phonePanelSheetStyle(
  overrides?: CSSProperties,
  anchor: PhoneMenuAnchor = 'left',
  layoutScale = 1,
): CSSProperties {
  return phoneCompactSheetStyle(phonePanelTop(), anchor, overrides, layoutScale)
}

/** Stacked submenu / nested panel on phone — same compact bounds, higher z-index. */
export function phoneSubmenuSheetStyle(
  overrides?: CSSProperties,
  anchor: PhoneMenuAnchor = 'left',
  layoutScale = 1,
): CSSProperties {
  return phoneCompactSheetStyle(phonePanelTop(), anchor, { zIndex: 45, ...overrides }, layoutScale)
}

/** Bottom sheet above FAB row (plus + pen) — compact, right-aligned like pen tools. */
export function phoneFabSheetStyle(overrides?: CSSProperties): CSSProperties {
  const fabRowHeight = 52
  const fabGap = 12
  const fabClearance = fabRowHeight + fabGap
  return {
    position: 'fixed',
    right: PHONE_CHROME_INSET,
    left: 'auto',
    bottom: `calc(${phoneBottomInset} + ${fabClearance}px)`,
    width: 'max-content',
    minWidth: 240,
    maxWidth: `min(300px, calc(100vw - ${PHONE_CHROME_INSET + 64}px))`,
    overflow: 'hidden',
    transformOrigin: '100% 100%',
    zIndex: 25,
    ...overrides,
  }
}

export const phoneFabMenuSlideMotion = {
  initial: { opacity: 0, scale: 0.9, y: 14 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 520, damping: 36, mass: 0.78 },
  },
  exit: {
    opacity: 0,
    scale: 0.94,
    y: 10,
    transition: { duration: 0.28, ease: [0.45, 0.05, 0.85, 0.45] as const },
  },
} as const

export const phoneSubmenuSlideMotion = {
  initial: { opacity: 0, y: 10, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 10, scale: 0.98 },
  transition: { duration: 0.18, ease: 'easeOut' },
} as const

export const phoneTopPanelSlideMotion = {
  initial: { opacity: 0, y: 10, scale: PHONE_TOP_PANEL_SCALE * 0.98 },
  animate: { opacity: 1, y: 0, scale: PHONE_TOP_PANEL_SCALE },
  exit: { opacity: 0, y: 10, scale: PHONE_TOP_PANEL_SCALE * 0.98 },
  transition: { duration: 0.18, ease: 'easeOut' },
} as const

/** Right-anchored top panels scale from the trigger corner. */
export const phoneTopPanelTransformOrigin = '100% 0'

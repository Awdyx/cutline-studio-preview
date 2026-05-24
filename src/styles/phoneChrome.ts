import type { CSSProperties } from 'react'

export const PHONE_CHROME_INSET = 12

/** Space below the two-row phone header (safe area + brand row + search row). */
export const PHONE_HEADER_BLOCK_HEIGHT = 96

const phoneHeaderTop = 'max(12px, env(safe-area-inset-top, 0px))'
const phoneBottomInset = 'max(12px, env(safe-area-inset-bottom, 0px))'

export function phonePanelTop(): string {
  return `calc(${phoneHeaderTop} + ${PHONE_HEADER_BLOCK_HEIGHT}px)`
}

/** Full-width sheet anchored below the phone header. */
export function phonePanelSheetStyle(overrides?: CSSProperties): CSSProperties {
  const top = phonePanelTop()
  return {
    position: 'fixed',
    top,
    left: PHONE_CHROME_INSET,
    right: PHONE_CHROME_INSET,
    width: 'auto',
    maxHeight: `calc(100dvh - ${top} - ${phoneBottomInset})`,
    ...overrides,
  }
}

/** Stacked submenu / nested panel on phone — same bounds, higher z-index. */
export function phoneSubmenuSheetStyle(overrides?: CSSProperties): CSSProperties {
  return phonePanelSheetStyle({ zIndex: 45, ...overrides })
}

/** Bottom sheet above FAB row (plus + pen). */
export function phoneFabSheetStyle(overrides?: CSSProperties): CSSProperties {
  const fabRowHeight = 52
  const fabGap = 12
  return {
    position: 'fixed',
    left: PHONE_CHROME_INSET,
    right: PHONE_CHROME_INSET,
    bottom: `calc(${phoneBottomInset} + ${fabRowHeight}px + ${fabGap}px)`,
    width: 'auto',
    maxHeight: 'min(62dvh, 520px)',
    zIndex: 25,
    ...overrides,
  }
}

export const phoneSubmenuSlideMotion = {
  initial: { opacity: 0, y: 10, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 10, scale: 0.98 },
  transition: { duration: 0.18, ease: 'easeOut' },
} as const

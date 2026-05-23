import type { CSSProperties } from 'react'

/** Global UI chroma / frosted-glass saturation multiplier (1 = default). */
export const UI_SATURATION_BOOST = 1

/** Inset horizontal rule for menus / submenus (rounded caps, does not touch panel edges). */
export const menuDividerStyle: CSSProperties = {
  height: 1,
  margin: '6px 16px',
  borderRadius: 999,
  background: 'var(--ui-divider)',
  flexShrink: 0,
}

/** Inset vertical rule between tool groups. */
export const menuDividerVerticalStyle: CSSProperties = {
  width: 1,
  height: 24,
  margin: '8px 0',
  borderRadius: 999,
  background: 'var(--ui-divider-vertical)',
  flexShrink: 0,
}

export const CHROME_GLASS_CLASS = 'ui-chrome-glass'
export const CHROME_CARD_CLASS = 'ui-chrome-card'
/** Opaque chrome surfaces (tool pills — no backdrop blur). */
export const CHROME_SOLID_CLASS = 'ui-chrome-solid'
/** Opt out of chrome lowercase for user-authored text inside chrome panels. */
export const CHROME_PRESERVE_CASE_CLASS = 'ui-chrome-preserve-case'

/** Lowercase fixed chrome UI copy (menus, buttons, headings — not canvas/user field values). */
export function chromeLabel(text: string): string {
  return text.toLowerCase()
}
/** Frosted space cards on the pan/zoom canvas (lighter blur than fixed chrome). */
export const SPACE_GLASS_CLASS = 'ui-space-glass'
/** Backdrop blur behind selected items (blur only — no saturate). */
export const SELECTION_DEPTH_CLASS = 'ui-selection-depth'

export const glass = {
  bg: 'var(--glass-bg)',
  border: '1px solid var(--glass-border)',
  shadow: 'var(--glass-shadow)',
  radius: '999px',
}

export const card = {
  bg: 'var(--card-bg)',
  border: '1px solid var(--glass-border)',
  shadow: 'var(--card-shadow)',
  radius: '16px',
  transitionDuration: '180ms',
}

/** Shared chrome menu open/close — Cutline panel + flyout dismiss. */
export const CHROME_MENU_TRANSITION = {
  duration: 0.18,
  ease: 'easeOut',
} as const

export function chromeMenuMotionY(offset: number) {
  return {
    initial: { opacity: 0, scale: 0.96, y: offset },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.96, y: offset },
    transition: CHROME_MENU_TRANSITION,
  }
}

export function chromeMenuMotionX(offset: number) {
  return {
    initial: { opacity: 0, scale: 0.96, x: offset },
    animate: { opacity: 1, scale: 1, x: 0 },
    exit: { opacity: 0, scale: 0.96, x: offset },
    transition: CHROME_MENU_TRANSITION,
  }
}

export const solid = {
  bg: 'var(--chrome-solid-bg)',
  border: '1px solid var(--glass-border)',
  shadow: 'var(--card-shadow)',
}

export const font = {
  family: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif',
  colorPrimary: 'var(--ui-text)',
  colorMuted: 'var(--ui-text-muted)',
  colorFaint: 'var(--ui-text-faint)',
}

/** Fixed bottom-right chrome — safe-area aware, sits flush in the visual viewport corner. */
export const chromeBottomRightFixed: CSSProperties = {
  position: 'fixed',
  bottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
  zIndex: 20,
}

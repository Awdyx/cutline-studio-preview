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

/** Phone profile panel + stack submenus — slightly tighter inset. */
export const phoneMenuDividerStyle: CSSProperties = {
  ...menuDividerStyle,
  margin: '4px 12px',
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
/** Tap squeeze target — the element that scales on pointer down. */
export const CHROME_TAP_SQUEEZE_TARGET_CLASS = 'chrome-tap-squeeze-target'
export const CHROME_CARD_CLASS = 'ui-chrome-card'
/** Deep-frost chrome menus — + FAB, pen FAB, flyouts, and top-bar panels. */
export const CHROME_FROSTED_MENU_CLASS = `${CHROME_GLASS_CLASS} ${CHROME_CARD_CLASS} plus-fab-menu-glass`
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

/** Shared with canvas customize backdrop — keep in sync with `--canvas-focus-backdrop-blur` in index.css. */
export const CANVAS_FOCUS_BACKDROP_BLUR_PX = 12

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

/** Hover lift + open-state background crossfade for frosted chrome islands/buttons.
 *  Also owns the filter transition so the customization-mode hover glow fades
 *  gently on all elements that carry an inline style (inline styles override CSS). */
export const CHROME_SURFACE_BG_TRANSITION = 'transform 0.2s ease-out, box-shadow 0.2s ease-out, background 150ms ease, filter 220ms ease-out'

export function chromeGlassSurfaceBg(options: {
  active?: boolean
  hoverLift?: boolean
} = {}): string {
  const { active = false, hoverLift = false } = options
  return active || hoverLift ? card.bg : glass.bg
}

/** Shared surface for frosted chrome menus (shadow comes from plus-fab-menu-glass CSS). */
export const chromeFrostedMenuStyle: CSSProperties = {
  background: glass.bg,
  border: glass.border,
  borderRadius: card.radius,
}

/** Shared chrome menu open/close — Cutline panel + flyout dismiss. */
export const CHROME_MENU_TRANSITION = {
  duration: 0.18,
  ease: 'easeOut',
} as const

/** FAB menu open — spring pop from the bottom-right corner. */
export const CHROME_FAB_MENU_SPRING = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 36,
  mass: 0.78,
}

/** FAB menu close — quick ease-in collapse back toward the trigger. */
export const CHROME_FAB_MENU_DISMISS = {
  duration: 0.28,
  ease: [0.45, 0.05, 0.85, 0.45] as const,
}

/** + FAB menu panel inner shell (motion lives on the wrapper). */
export const PLUS_FAB_MENU_PANEL_CLASS = 'plus-fab-menu-panel'

/**
 * FAB menu spring — apply on the frosted panel itself (same pattern as + FAB).
 * No CSS filter (filter on an ancestor breaks backdrop-filter).
 */
export function chromeFabMenuWrapperMotion(reduceMotion: boolean | null) {
  if (reduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.12 } },
      exit: { opacity: 0, transition: { duration: 0.12 } },
    }
  }
  return {
    initial: { opacity: 0, scale: 0.86, y: 16 },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: CHROME_FAB_MENU_SPRING,
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      y: 10,
      transition: CHROME_FAB_MENU_DISMISS,
    },
  }
}

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

/** Fixed bottom-right chrome — above study-hub menu-focus portal (24), below panels (30+). */
export const chromeBottomRightFixed: CSSProperties = {
  position: 'fixed',
  bottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
  zIndex: 26,
}

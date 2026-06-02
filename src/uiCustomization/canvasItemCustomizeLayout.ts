import { isPhoneLayout } from '../platform/layoutProfile'
import { PHONE_HEADER_BLOCK_HEIGHT } from '../styles/phoneChrome'

const TRAY_CLEARANCE = 300
const TOOLBAR_CLEARANCE = 88
const PAD_X_DESKTOP = 56
const PAD_X_PHONE = 16
const PAD_TOP_DESKTOP = 120

/** Customize stage is this fraction of the item's on-canvas screen appearance. */
export const CANVAS_ITEM_CUSTOMIZE_STAGE_FACTOR = 0.9

export type CanvasItemCustomizePlacement = {
  left: number
  top: number
  /** Uniform screen scale applied to the canvas-layout stage (transform, not reflow). */
  scale: number
  visualWidth: number
  visualHeight: number
}

function customizeZone(): {
  padTop: number
  availW: number
  availH: number
} {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const padX = isPhoneLayout() ? PAD_X_PHONE : PAD_X_DESKTOP
  const padTop = isPhoneLayout()
    ? PHONE_HEADER_BLOCK_HEIGHT + TOOLBAR_CLEARANCE
    : PAD_TOP_DESKTOP
  const padBottom = TRAY_CLEARANCE
  return {
    padTop,
    availW: Math.max(1, vw - padX * 2),
    availH: Math.max(1, vh - padTop - padBottom),
  }
}

/** Screen pixels per canvas unit — matches the item's live on-canvas appearance. */
function computeCanvasItemCustomizeContentScale(
  sourceScreenWidth: number,
  itemCanvasWidth: number,
): number {
  return sourceScreenWidth / Math.max(1, itemCanvasWidth)
}

/**
 * Target placement for customize — centred above the tray at 90% of the
 * on-canvas screen size. Layout stays in canvas coordinates; only the
 * display transform scale changes.
 */
export function computeCanvasItemCustomizeTargetPlacement(
  sourceScreenWidth: number,
  sourceScreenHeight: number,
  itemCanvasWidth: number,
  itemCanvasHeight: number,
): CanvasItemCustomizePlacement {
  const vw = window.innerWidth
  const { padTop, availW, availH } = customizeZone()
  const baseScale = computeCanvasItemCustomizeContentScale(
    sourceScreenWidth,
    itemCanvasWidth,
  )

  let scale = baseScale * CANVAS_ITEM_CUSTOMIZE_STAGE_FACTOR
  let visualWidth = itemCanvasWidth * scale
  let visualHeight = itemCanvasHeight * scale

  if (visualWidth > availW || visualHeight > availH) {
    const widthShrink = availW / visualWidth
    const heightShrink = availH / visualHeight
    const shrink = Math.min(widthShrink, heightShrink, 1)
    scale *= shrink
    visualWidth = itemCanvasWidth * scale
    visualHeight = itemCanvasHeight * scale
  }

  return {
    left: (vw - visualWidth) / 2,
    top: padTop + (availH - visualHeight) / 2,
    scale,
    visualWidth,
    visualHeight,
  }
}

/** Shared easing for chrome customize backdrop / vignette. */
export const UI_CUSTOMIZE_EASE_OUT = [0.16, 1, 0.3, 1] as const

/** Canvas item lift from on-canvas position to centred stage (matches chrome anchor focus). */
export const CANVAS_CUSTOMIZE_LIFT_EASE = [0.32, 1.2, 0.55, 1] as const

export const CANVAS_CUSTOMIZE_LIFT_TRANSITION = {
  duration: 0.38,
  ease: CANVAS_CUSTOMIZE_LIFT_EASE,
} as const

/** CSS transition for canvas-item customize lift (matches chrome anchor focus). */
export const CANVAS_CUSTOMIZE_LIFT_CSS_TRANSITION =
  'transform 380ms cubic-bezier(0.32, 1.2, 0.55, 1)'

export const UI_CUSTOMIZE_BACKDROP_ENTER = {
  opacity: { duration: 0.48, ease: UI_CUSTOMIZE_EASE_OUT },
} as const

export const UI_CUSTOMIZE_BACKDROP_EXIT = {
  opacity: { duration: 0.44, ease: [0.45, 0, 0.2, 1] },
} as const

/** Keep chrome customize backdrop visible while blur/dim CSS transition finishes. */
export const UI_CUSTOMIZE_BACKDROP_RELEASE_MS = 920

/**
 * Selection blur keeps `data-selection-blur-active` this long after dismiss so
 * the portal can finish while blur/dim fade on the existing selection stack.
 */
export const CANVAS_CUSTOMIZE_BLUR_RELEASE_MS = 520

export const CANVAS_CUSTOMIZE_BLUR_RELEASE_TRANSITION =
  UI_CUSTOMIZE_BACKDROP_EXIT

export const UI_CUSTOMIZE_VIGNETTE_ENTER = {
  opacity: { duration: 1.05, ease: UI_CUSTOMIZE_EASE_OUT, delay: 0.06 },
} as const

export const UI_CUSTOMIZE_VIGNETTE_EXIT = {
  opacity: { duration: 0.92, ease: UI_CUSTOMIZE_EASE_OUT },
} as const

/** Bottom chrome (toolbar + tray) — matches UiCustomizationLayer focused panel. */
export const UI_CUSTOMIZE_CHROME_PANEL_SPRING = {
  type: 'spring' as const,
  stiffness: 320,
  damping: 26,
  mass: 0.7,
}

export const UI_CUSTOMIZE_CHROME_PANEL_ENTER = {
  opacity: { duration: 0.44, ease: UI_CUSTOMIZE_EASE_OUT },
  y: { duration: 0.44, ease: UI_CUSTOMIZE_EASE_OUT },
} as const

export const UI_CUSTOMIZE_CHROME_PANEL_EXIT = {
  opacity: { duration: 0.36, ease: UI_CUSTOMIZE_EASE_OUT },
  y: { duration: 0.36, ease: UI_CUSTOMIZE_EASE_OUT },
} as const

export const UI_CUSTOMIZE_CHROME_BACKDROP = {
  light: 'rgba(0, 0, 0, 0.18)',
  dark: 'rgba(0, 0, 0, 0.44)',
} as const

export const UI_CUSTOMIZE_CANVAS_BACKDROP = {
  light: 'rgba(0, 0, 0, 0.06)',
  dark: 'rgba(0, 0, 0, 0.18)',
} as const

import { CANVAS_FOCUS_BACKDROP_BLUR_PX } from '../styles/tokens'

export const UI_CUSTOMIZE_BACKDROP_BLUR_OFF = 'blur(0px) saturate(1)'
export const UI_CUSTOMIZE_CHROME_BACKDROP_BLUR = `blur(${CANVAS_FOCUS_BACKDROP_BLUR_PX}px) saturate(0.92)`
export const UI_CUSTOMIZE_CANVAS_BACKDROP_BLUR = `blur(${CANVAS_FOCUS_BACKDROP_BLUR_PX}px) saturate(1)`

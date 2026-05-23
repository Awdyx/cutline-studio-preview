export type ViewportSize = { width: number; height: number }

export type LayoutViewportRect = {
  left: number
  top: number
  width: number
  height: number
}

/** Screen box for fixed UI — respects iOS keyboard via visualViewport. */
export function readLayoutViewport(): LayoutViewportRect {
  const vv = window.visualViewport
  if (vv && vv.width > 0 && vv.height > 0) {
    return {
      left: vv.offsetLeft,
      top: vv.offsetTop,
      width: vv.width,
      height: vv.height,
    }
  }

  return {
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

/** iPad landscape software keyboard — used before it animates in. */
const TOUCH_KEYBOARD_HEIGHT_RATIO = 0.42

/**
 * Visible area for spawning text/sticky — shrinks on touch so new items stay
 * above the keyboard; uses visualViewport when the keyboard is already open.
 */
export function readEditablePlacementRect(
  viewportHost?: HTMLElement | null,
): LayoutViewportRect {
  const hostRect = viewportHost?.getBoundingClientRect()
  const vv = window.visualViewport

  if (
    vv &&
    vv.height > 0 &&
    hostRect &&
    hostRect.height > 0 &&
    vv.height < hostRect.height * 0.82
  ) {
    return {
      left: vv.offsetLeft,
      top: vv.offsetTop,
      width: vv.width,
      height: vv.height,
    }
  }

  const base: LayoutViewportRect = hostRect
    ? {
        left: hostRect.left,
        top: hostRect.top,
        width: hostRect.width,
        height: hostRect.height,
      }
    : readLayoutViewport()

  if (window.matchMedia('(pointer: coarse)').matches) {
    return {
      left: base.left,
      top: base.top,
      width: base.width,
      height: base.height * (1 - TOUCH_KEYBOARD_HEIGHT_RATIO),
    }
  }

  return base
}

/** Prefer visual viewport on iOS — layout size can lag after rotation. */
export function readViewportSize(host?: HTMLElement | null): ViewportSize | null {
  const rect = host?.getBoundingClientRect()
  const vv = window.visualViewport

  if (rect && rect.width > 0 && rect.height > 0) {
    if (vv && vv.width > 0 && vv.height > 0) {
      // During iOS rotation one metric can lag; cover the larger visible box.
      return {
        width: Math.max(rect.width, vv.width),
        height: Math.max(rect.height, vv.height),
      }
    }
    return { width: rect.width, height: rect.height }
  }

  if (vv && vv.width > 0 && vv.height > 0) {
    return {
      width: Math.round(vv.width),
      height: Math.round(vv.height),
    }
  }

  return null
}

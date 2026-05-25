/** Default + / pen FAB diameter (desktop + phone). */
export const CHROME_FAB_SIZE = 52

/** Larger touch target on iPad / tablet (coarse pointer, not phone width). */
export const CHROME_FAB_SIZE_TABLET = 76

export const CHROME_FAB_ICON_SIZE = 22
export const CHROME_FAB_ICON_SIZE_TABLET = 30

export const CHROME_FAB_GAP = 12
export const CHROME_FAB_MARGIN = 16

export function chromeFabSize(isTablet: boolean): number {
  return isTablet ? CHROME_FAB_SIZE_TABLET : CHROME_FAB_SIZE
}

export function chromeFabIconSize(isTablet: boolean): number {
  return isTablet ? CHROME_FAB_ICON_SIZE_TABLET : CHROME_FAB_ICON_SIZE
}

/** Pen FAB sits left of the + FAB — keep in sync with CSS `--chrome-fab-size`. */
export function penFabRightOffset(isTablet: boolean): number {
  return CHROME_FAB_MARGIN + chromeFabSize(isTablet) + CHROME_FAB_GAP
}

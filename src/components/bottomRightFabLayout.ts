/** Shared bottom-right FAB row geometry — pen sits left of + when both are visible. */
export const BOTTOM_RIGHT_FAB_MARGIN_PX = 16
export const BOTTOM_RIGHT_FAB_SIZE_PX = 52
export const BOTTOM_RIGHT_FAB_GAP_PX = 12
export const BOTTOM_RIGHT_FAB_SLOT_SHIFT_PX =
  BOTTOM_RIGHT_FAB_SIZE_PX + BOTTOM_RIGHT_FAB_GAP_PX

export const bottomRightFabRightCss = (marginPx = BOTTOM_RIGHT_FAB_MARGIN_PX) =>
  `calc(${marginPx}px + env(safe-area-inset-right, 0px))`

export const bottomRightFabPenRightCss = (marginPx = BOTTOM_RIGHT_FAB_MARGIN_PX) =>
  `calc(${marginPx}px + ${BOTTOM_RIGHT_FAB_SLOT_SHIFT_PX}px + env(safe-area-inset-right, 0px))`

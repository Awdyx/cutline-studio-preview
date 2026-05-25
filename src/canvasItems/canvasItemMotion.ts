/** Subtle fade + shrink when a canvas item is removed. */
export const canvasItemDeleteExit = {
  opacity: 0,
  scale: 0.97,
} as const

export const canvasItemDeleteExitTransition = {
  duration: 0.2,
  ease: [0.4, 0, 0.2, 1] as const,
}

/** Matches space-drop absorb so removal does not flash on transfer. */
export const canvasItemSpaceTransferExit = {
  opacity: 0,
  scale: 0.86,
} as const

export const canvasItemSpaceTransferExitTransition = {
  duration: 0.12,
  ease: [0.4, 0, 0.2, 1] as const,
}

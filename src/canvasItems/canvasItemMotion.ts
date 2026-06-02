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

/** Viewport cull remount — slow opacity (+ subtle scale) so heavy items do not snap in. */
export const canvasItemCullEnterInitial = {
  opacity: 0,
  scale: 0.982,
} as const

export const canvasItemCullEnterTransition = {
  opacity: { duration: 0.52, ease: [0.16, 1, 0.3, 1] as const },
  scale: { duration: 0.52, ease: [0.16, 1, 0.3, 1] as const },
  boxShadow: { duration: 0.52, ease: [0.16, 1, 0.3, 1] as const },
}

/** Drag/resize lift on canvas item shells (and matching sticky overflow previews). */
export const canvasItemLiftSpring = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 28,
  mass: 0.7,
}

/** Embedded image peeling off a sticky before reparenting. */
export const stickyBringOutEmbeddedTransition = {
  scale: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const },
  opacity: { duration: 0.16, delay: 0.14, ease: [0.4, 0, 1, 1] as const },
  boxShadow: { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const },
}

/** Canvas image settling after bring-out reparent. */
export const stickyBringOutCanvasEnterTransition = {
  type: 'spring' as const,
  stiffness: 460,
  damping: 32,
  mass: 0.72,
}

/** Pasted image replacing a selected canvas image — subtle dissolve + settle. */
export const canvasItemMediaSwapEnter = {
  opacity: 0,
  scale: 0.985,
} as const

export const canvasItemMediaSwapEnterTransition = {
  opacity: { duration: 0.32, ease: [0.16, 1, 0.3, 1] as const },
  scale: { duration: 0.36, ease: [0.16, 1, 0.3, 1] as const },
}

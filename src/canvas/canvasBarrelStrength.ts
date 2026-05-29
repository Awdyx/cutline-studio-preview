/** Fixed feDisplacementMap scale while the fisheye overview is engaged. */
export const BARREL_DISPLACEMENT_PX = 240

export const CANVAS_BARREL_FILTER_ID = 'cutline-canvas-barrel'

/**
 * Engage the fisheye once zoomed into the most-zoomed-out band — within
 * ENGAGE_BAND of the resting min scale ("~90% of max zoom out").
 */
const ENGAGE_BAND = 0.1

/** Where we settle after the user taps to leave overview — clearly inside. */
const EXIT_BAND = 0.25

export function barrelEngageScale(minScale: number): number {
  return minScale * (1 + ENGAGE_BAND)
}

export function isBarrelEngaged(scale: number, minScale: number): boolean {
  return scale <= barrelEngageScale(minScale)
}

export function barrelExitScale(minScale: number): number {
  return minScale * (1 + EXIT_BAND)
}

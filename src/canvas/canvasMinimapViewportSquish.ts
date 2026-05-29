import type { EdgeStrengths } from '../canvasPanVignette'

export type MinimapViewportSquish = {
  scaleX: number
  scaleY: number
  originX: number
  originY: number
}

export const IDLE_MINIMAP_VIEWPORT_SQUISH: MinimapViewportSquish = {
  scaleX: 1,
  scaleY: 1,
  originX: 50,
  originY: 50,
}

const MAX_COMPRESS = 0.13
const MAX_BULGE = 0.042
const ORIGIN_THRESHOLD = 0.025

/** Rubber-band scale for the minimap viewport frame from pan edge pressure. */
export function squishFromEdgePressures(
  edges: EdgeStrengths,
): MinimapViewportSquish {
  const { left, right, top, bottom } = edges
  const compressX = left + right
  const compressY = top + bottom

  let originX = 50
  let originY = 50

  if (left > right && left > ORIGIN_THRESHOLD) originX = 0
  else if (right > left && right > ORIGIN_THRESHOLD) originX = 100

  if (top > bottom && top > ORIGIN_THRESHOLD) originY = 0
  else if (bottom > top && bottom > ORIGIN_THRESHOLD) originY = 100

  const scaleX =
    1 - compressX * MAX_COMPRESS + compressY * MAX_BULGE * 0.38
  const scaleY =
    1 - compressY * MAX_COMPRESS + compressX * MAX_BULGE * 0.38

  return { scaleX, scaleY, originX, originY }
}

const SQUISH_ATTACK = 0.54
const SQUISH_RELEASE = 0.2
const ORIGIN_ATTACK = 0.62
const ORIGIN_RELEASE = 0.26
const IDLE_EPS = 0.0015

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function stepMinimapViewportSquish(
  prev: MinimapViewportSquish,
  target: MinimapViewportSquish,
): MinimapViewportSquish {
  const pushing =
    target.scaleX < 1 - IDLE_EPS ||
    target.scaleY < 1 - IDLE_EPS ||
    target.scaleX > 1 + IDLE_EPS ||
    target.scaleY > 1 + IDLE_EPS

  const scaleRate = pushing ? SQUISH_ATTACK : SQUISH_RELEASE
  const originRate = pushing ? ORIGIN_ATTACK : ORIGIN_RELEASE

  const next: MinimapViewportSquish = {
    scaleX: lerp(prev.scaleX, target.scaleX, scaleRate),
    scaleY: lerp(prev.scaleY, target.scaleY, scaleRate),
    originX: lerp(prev.originX, target.originX, originRate),
    originY: lerp(prev.originY, target.originY, originRate),
  }

  const atIdle =
    !pushing &&
    Math.abs(next.scaleX - 1) < IDLE_EPS &&
    Math.abs(next.scaleY - 1) < IDLE_EPS &&
    Math.abs(next.originX - 50) < 0.4 &&
    Math.abs(next.originY - 50) < 0.4

  return atIdle ? IDLE_MINIMAP_VIEWPORT_SQUISH : next
}

export function minimapViewportSquishTransform(
  squish: MinimapViewportSquish,
): string {
  if (
    squish.scaleX === 1 &&
    squish.scaleY === 1 &&
    squish.originX === 50 &&
    squish.originY === 50
  ) {
    return ''
  }
  return `scale(${squish.scaleX.toFixed(4)}, ${squish.scaleY.toFixed(4)})`
}

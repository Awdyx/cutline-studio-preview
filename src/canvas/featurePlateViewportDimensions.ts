import {
  FEATURE_PLATE_HEIGHT,
  FEATURE_PLATE_WIDTH,
} from '../drawing/canvasDimensions'

const MAX_W = FEATURE_PLATE_WIDTH   // 2250
const MAX_H = FEATURE_PLATE_HEIGHT  // 1406
const REF_AREA = MAX_W * MAX_H      // ~3,163,500 — stays constant on resize

export type FeaturePlateDimensions = {
  width: number
  height: number
  aspect: number
}

/**
 * Constant-area resize: the footprint area stays ~fixed, only the shape
 * (aspect ratio) tracks the window. Capped to the original bounding box so
 * plates never grow larger than the designer-set size.
 */
export function computeFeaturePlateDimensions(
  viewportWidth: number,
  viewportHeight: number,
): FeaturePlateDimensions {
  const aspect = viewportWidth / Math.max(1, viewportHeight)

  // Constant-area gives same visual "mass" regardless of shape.
  let height = Math.round(Math.sqrt(REF_AREA / aspect))
  let width = Math.round(height * aspect)

  // Cap to original bounding box — plates must never grow bigger than set.
  if (width > MAX_W) {
    width = MAX_W
    height = Math.round(MAX_W / aspect)
  }
  if (height > MAX_H) {
    height = MAX_H
    width = Math.round(MAX_H * aspect)
  }

  width = Math.max(1, width)
  height = Math.max(1, height)

  return { width, height, aspect: width / height }
}

export const DEFAULT_FEATURE_PLATE_DIMENSIONS: FeaturePlateDimensions =
  computeFeaturePlateDimensions(FEATURE_PLATE_WIDTH, FEATURE_PLATE_HEIGHT)

/** Reads the actual canvas viewport box — avoids visualViewport max() spikes mid-resize. */
export function readFeaturePlateViewportSize(
  viewportHost?: HTMLElement | null,
): { width: number; height: number } {
  const rect = viewportHost?.getBoundingClientRect()
  if (rect && rect.width > 0 && rect.height > 0) {
    return { width: Math.round(rect.width), height: Math.round(rect.height) }
  }
  return {
    width: Math.max(1, Math.round(window.innerWidth)),
    height: Math.max(1, Math.round(window.innerHeight)),
  }
}

/** Returns null if new dims are within 1px of current — avoids jitter. */
export function featurePlateDimensionsForViewport(
  viewportWidth: number,
  viewportHeight: number,
  prev?: FeaturePlateDimensions,
): FeaturePlateDimensions | null {
  const next = computeFeaturePlateDimensions(viewportWidth, viewportHeight)
  if (
    prev &&
    Math.abs(prev.width - next.width) < 2 &&
    Math.abs(prev.height - next.height) < 2
  ) {
    return null
  }
  return next
}

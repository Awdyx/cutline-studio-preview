import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { STUDY_HUB_HEIGHT, STUDY_HUB_WIDTH } from './types'

const MIN_SPAWN_SCALE = 0.05
const MAX_SPAWN_SCALE = 8

/** Default on-canvas footprint relative to design size (1 = full design width). */
export const STUDY_HUB_SPAWN_SIZE_FACTOR = 0.75

export function normalizeSpawnScale(spawnScale: number): number {
  if (!Number.isFinite(spawnScale) || spawnScale <= 0) return 1
  return Math.min(MAX_SPAWN_SCALE, Math.max(MIN_SPAWN_SCALE, spawnScale))
}

export function readCanvasTransformScale(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
): number {
  try {
    const scale = transformRef.current?.state?.scale
    if (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0) return 1
    return scale
  } catch {
    return 1
  }
}

/** Canvas-space size so the widget reads at the design size on screen at `spawnScale`. */
export function studyHubCanvasSize(spawnScale: number): {
  width: number
  height: number
} {
  const scale = normalizeSpawnScale(spawnScale)
  const factor = STUDY_HUB_SPAWN_SIZE_FACTOR
  return {
    width: (STUDY_HUB_WIDTH / scale) * factor,
    height: (STUDY_HUB_HEIGHT / scale) * factor,
  }
}

export function studyHubContentScale(spawnScale: number | undefined): number {
  return 1 / normalizeSpawnScale(spawnScale ?? 1)
}

/** Design corner radius at {@link STUDY_HUB_WIDTH} — matches card.radius (16px). */
export const STUDY_HUB_DESIGN_RADIUS = 16

/** Corner radius that stays proportional when the hub is resized on canvas or zoomed in focus. */
export function studyHubBorderRadiusForWidth(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return STUDY_HUB_DESIGN_RADIUS
  return STUDY_HUB_DESIGN_RADIUS * (width / STUDY_HUB_WIDTH)
}

export function studyHubBorderRadiusCss(width: number): string {
  return `${studyHubBorderRadiusForWidth(width)}px`
}

/** Scale inner layout to match the item's current canvas width. */
export function studyHubContentScaleForSize(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 1
  return width / STUDY_HUB_WIDTH
}

/** Stagger offset in canvas units — constant on screen regardless of zoom. */
export function studyHubStackOffset(stackIndex: number, spawnScale: number): {
  x: number
  y: number
} {
  const step = 28 / normalizeSpawnScale(spawnScale)
  return {
    x: (stackIndex % 3) * step,
    y: Math.floor(stackIndex / 3) * step,
  }
}

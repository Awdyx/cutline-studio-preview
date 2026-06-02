import type { SpaceTintId } from './types'

/** Pocket tints — slightly lifted from pen highlighter inks, still clearly coloured. */
const SPACE_TINT_RGB: Record<SpaceTintId, readonly [number, number, number]> = {
  yellow: [255, 249, 180],
  pink: [255, 180, 206],
  blue: [167, 206, 255],
  green: [198, 234, 168],
}

const SPACE_TINT_SWATCH_ALPHA = 0.35
const SPACE_TINT_GLASS_ALPHA = 0.16

function spaceTintRgba(tint: SpaceTintId, alpha: number): string {
  const [r, g, b] = SPACE_TINT_RGB[tint]
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Swatch fill in the pocket tint menu. */
export function resolveSpaceTintSwatchColor(tint: SpaceTintId): string {
  return spaceTintRgba(tint, SPACE_TINT_SWATCH_ALPHA)
}

/** Subtle wash over frosted glass — light mode only. */
export function resolveSpaceTintGlassOverlay(
  tint: SpaceTintId | undefined,
  mode: 'light' | 'dark',
): string | null {
  if (mode === 'dark' || !tint) return null
  return spaceTintRgba(tint, SPACE_TINT_GLASS_ALPHA)
}

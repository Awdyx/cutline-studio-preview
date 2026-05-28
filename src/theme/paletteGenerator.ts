import { formatHex, formatRgb, parse } from 'culori'
import { UI_SATURATION_BOOST } from '../styles/tokens'

/** User-adjustable canvas ambience (lightness-only mesh blobs). */
export type PaletteConfig = {
  /** 0 = nearly flat canvas, 1 = more pronounced lightness blobs (still capped subtle). */
  blobDepth: number
}

export type GeneratedPalette = {
  meshColors: string[]
  vignetteColor: string
  vignetteRgba: string
  vignetteRgbaMid: string
  vignetteRgbaSoft: string
  vignetteGlowRgba: string
  uiText: string
  uiTextMuted: string
  uiTextFaint: string
  uiBg: string
  uiGlassBg: string
  uiGlassBorder: string
  uiCardBg: string
  uiSolidBg: string
  uiAccent: string
}

/** Max slider value for blob depth control. */
export const MAX_BLOB_DEPTH = 1

const BLOB_LIGHTNESS_STOPS = [-1, -0.55, 0, 0.45, 0.85] as const
/** Subtle cap so blobs stay ambient, not decorative color washes. */
const MAX_BLOB_LIGHTNESS_DELTA = 0.0504

/** Center first, then adjacent, then corner blobs. */
const BLOB_REVEAL_ORDER = [2, 1, 3, 0, 4] as const
const BLOB_REVEAL_BAND = 1 / BLOB_LIGHTNESS_STOPS.length

const NEUTRAL_HUE = 250

/** Dark-mode edge vignette is scaled down so the light rim wash stays subtle. */
const DARK_VIGNETTE_ALPHA_SCALE = 0.55

function uiChroma(c: number): number {
  return c * UI_SATURATION_BOOST
}

function clampBlobDepth(depth: number): number {
  return Math.min(MAX_BLOB_DEPTH, Math.max(0, depth))
}

/** Per-blob visibility (0–1) for mesh layers; higher depth reveals more blobs. */
export function meshBlobVisibilities(depth: number): number[] {
  const d = clampBlobDepth(depth)
  const rankByIndex = new Map<number, number>()
  BLOB_REVEAL_ORDER.forEach((index, rank) => rankByIndex.set(index, rank))

  return BLOB_LIGHTNESS_STOPS.map((_, index) => {
    const rank = rankByIndex.get(index) ?? index
    const start = rank * BLOB_REVEAL_BAND
    const end = start + BLOB_REVEAL_BAND
    if (d <= start) return 0
    if (d >= end) return 1
    return (d - start) / (end - start)
  })
}

function neutral(l: number, chroma = 0): string {
  return formatHex({ mode: 'oklch', l, c: chroma, h: NEUTRAL_HUE }) ?? '#888888'
}

export function hexToRgba(hex: string, alpha: number): string {
  const parsed = parse(hex)
  if (!parsed) return `rgba(26, 26, 26, ${alpha})`
  const rgb = formatRgb(parsed)
  const match = rgb.match(/rgba?\(([^)]+)\)/)
  if (!match) return `rgba(26, 26, 26, ${alpha})`
  const parts = match[1].split(',').map((s: string) => s.trim())
  const r = parts[0]
  const g = parts[1]
  const b = parts[2]
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function generatePalette(
  config: PaletteConfig,
  mode: 'light' | 'dark',
): GeneratedPalette {
  const depth = clampBlobDepth(config.blobDepth)
  const spread = depth * MAX_BLOB_LIGHTNESS_DELTA

  const meshBaseL = mode === 'light' ? 0.94 : 0.24

  const meshColors = BLOB_LIGHTNESS_STOPS.map((stop) =>
    neutral(meshBaseL + stop * spread),
  )

  const vignetteColor =
    mode === 'light'
      ? neutral(0.22, uiChroma(0.004))
      : neutral(0.94, uiChroma(0.006))
  const vignetteRgba = hexToRgba(
    vignetteColor,
    mode === 'light' ? 0.28 : 0.12 * DARK_VIGNETTE_ALPHA_SCALE,
  )
  const vignetteRgbaMid = hexToRgba(
    vignetteColor,
    mode === 'light' ? 0.15 : 0.07 * DARK_VIGNETTE_ALPHA_SCALE,
  )
  const vignetteRgbaSoft = hexToRgba(
    vignetteColor,
    mode === 'light' ? 0.06 : 0.03 * DARK_VIGNETTE_ALPHA_SCALE,
  )
  const vignetteGlowColor =
    mode === 'light'
      ? neutral(0.16, uiChroma(0.008))
      : neutral(0.97, uiChroma(0.01))
  const vignetteGlowRgba = hexToRgba(
    vignetteGlowColor,
    mode === 'light' ? 0.34 : 0.16 * DARK_VIGNETTE_ALPHA_SCALE,
  )

  const uiText = neutral(mode === 'light' ? 0.22 : 0.93, uiChroma(0.006))
  const uiTextMuted = neutral(mode === 'light' ? 0.48 : 0.68, uiChroma(0.008))
  const uiTextFaint = neutral(mode === 'light' ? 0.7 : 0.5, uiChroma(0.006))
  const uiBg = neutral(mode === 'light' ? 0.98 : 0.18, uiChroma(0.004))

  const uiGlassBg =
    mode === 'light' ? 'rgba(255, 255, 255, 0.55)' : 'rgba(34, 36, 40, 0.55)'
  const uiGlassBorder =
    mode === 'light' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.08)'
  const uiCardBg =
    mode === 'light' ? 'rgba(255, 255, 255, 0.72)' : 'rgba(44, 46, 50, 0.72)'
  const uiSolidBg =
    mode === 'light' ? '#ffffff' : neutral(0.24, uiChroma(0.004))

  const uiAccent = neutral(mode === 'light' ? 0.42 : 0.72, uiChroma(0.01))

  return {
    meshColors,
    vignetteColor,
    vignetteRgba,
    vignetteRgbaMid,
    vignetteRgbaSoft,
    vignetteGlowRgba,
    uiText,
    uiTextMuted,
    uiTextFaint,
    uiBg,
    uiGlassBg,
    uiGlassBorder,
    uiCardBg,
    uiSolidBg,
    uiAccent,
  }
}

/** Canvas fill behind mesh layers (center stop). */
export function canvasBackgroundColor(
  config: PaletteConfig,
  mode: 'light' | 'dark',
): string {
  const depth = clampBlobDepth(config.blobDepth)
  const spread = depth * MAX_BLOB_LIGHTNESS_DELTA
  const baseCanvasL = mode === 'light' ? 0.965 : 0.2
  return neutral(baseCanvasL + BLOB_LIGHTNESS_STOPS[2] * spread * 0.35)
}

/** Sticky note surface — warm paper in light mode; lifted light grey on dark canvas. */
export function resolveStickyColor(mode: 'light' | 'dark'): string {
  return mode === 'light' ? '#F5F1D4' : neutral(0.30, uiChroma(0.006))
}

export function resolveStickyTextColor(mode: 'light' | 'dark'): string {
  return mode === 'light' ? '#423a24' : neutral(0.9, uiChroma(0.006))
}

type StickyColorId = 'yellow' | 'pink' | 'blue'

/** Light-mode sticky surface colours for each preset. */
const STICKY_BG_LIGHT: Record<StickyColorId, string> = {
  yellow: '#F5F1D4',
  pink: '#FAE1EF',
  blue: '#DBECF9',
}

/** Resolve the background colour for a sticky preset in a given theme mode. */
export function resolveStickyColorById(id: StickyColorId | undefined, mode: 'light' | 'dark'): string {
  if (mode === 'dark') return resolveStickyColor('dark')
  if (!id || id === 'yellow') return resolveStickyColor('light')
  return STICKY_BG_LIGHT[id]
}

/** UI swatch colour (always opaque, shown in menus regardless of theme). */
export const STICKY_SWATCH_COLORS: Record<StickyColorId, string> = {
  yellow: '#F5F1D4',
  pink: '#FAE1EF',
  blue: '#DBECF9',
}

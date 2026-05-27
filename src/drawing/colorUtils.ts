/** Stored on strokes / tool state — resolves per light/dark theme. */
export const CONTRAST_INK = '__contrast__' as const

/** Default pen ink on a light canvas — neutral grey (no color tint). */
export const CONTRAST_PEN_LIGHT = '#525252'

/** Same ink on a dark canvas — neutral off-white (no color tint). */
export const CONTRAST_PEN_DARK = '#dadada'

/** Pen inks — first swatch is theme-adaptive contrast ink. */
export const PEN_PRESETS = [
  CONTRAST_INK,
  '#4A9FD4',
  '#E07070',
  '#F0C818',
] as const

export const DEFAULT_PEN_COLOR = CONTRAST_INK

export const HIGHLIGHTER_PRESETS = [
  'rgba(255, 245, 140, 0.35)',
  'rgba(255, 140, 180, 0.35)',
  'rgba(120, 180, 255, 0.35)',
] as const

export const DEFAULT_HIGHLIGHTER_COLOR = HIGHLIGHTER_PRESETS[0]

/** Dark-mode highlighter fills — slightly lifted for plus-lighter blend; keep opacity low. */
export const HIGHLIGHTER_DARK_GLOW = [
  'rgba(255, 238, 130, 0.38)',
  'rgba(255, 158, 210, 0.36)',
  'rgba(150, 200, 255, 0.36)',
] as const

const LEGACY_CONTRAST_HEX = new Set(
  [
    CONTRAST_PEN_LIGHT,
    CONTRAST_PEN_DARK,
    '#4f5568',
    '#595959',
    '#d4d8e2',
    '#e4e7ef',
    '#e8ebf2',
    '#d8dce6',
  ].map((c) => c.toLowerCase()),
)

export function isContrastInk(color: string): boolean {
  return color === CONTRAST_INK || LEGACY_CONTRAST_HEX.has(color.toLowerCase())
}

/** Normalize persisted pen ink to contrast token when it was the old default grey. */
export function normalizeStoredPenInk(color: string): string {
  return isContrastInk(color) ? CONTRAST_INK : color
}

export function resolvePenColor(
  ink: string,
  mode: 'light' | 'dark',
): string {
  if (isContrastInk(ink)) {
    return mode === 'light' ? CONTRAST_PEN_LIGHT : CONTRAST_PEN_DARK
  }
  return ink
}

export function penInkMatches(a: string, b: string): boolean {
  if (isContrastInk(a) && isContrastInk(b)) return true
  return a.toLowerCase() === b.toLowerCase()
}

function highlighterPresetIndex(color: string): number {
  return HIGHLIGHTER_PRESETS.findIndex(
    (preset) => preset.toLowerCase() === color.toLowerCase(),
  )
}

/** Boost unknown rgba highlighters for dark canvas glow. */
function boostRgbaForDarkGlow(color: string): string {
  const match = color.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i,
  )
  if (!match) return color
  const r = Math.min(255, Math.round(Number(match[1]) * 1.05 + 12))
  const g = Math.min(255, Math.round(Number(match[2]) * 1.05 + 12))
  const b = Math.min(255, Math.round(Number(match[3]) * 1.05 + 12))
  const a = Math.min(0.48, (match[4] !== undefined ? Number(match[4]) : 1) * 1.2)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

export function resolveHighlighterColor(
  color: string,
  mode: 'light' | 'dark',
): string {
  if (mode === 'light') return color
  const idx = highlighterPresetIndex(color)
  if (idx >= 0) return HIGHLIGHTER_DARK_GLOW[idx]
  return boostRgbaForDarkGlow(color)
}

export function resolveStrokeFill(
  color: string,
  tool: 'pen' | 'highlighter',
  mode: 'light' | 'dark',
): string {
  if (tool === 'pen') return resolvePenColor(color, mode)
  return resolveHighlighterColor(color, mode)
}

function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.match(/^#?([0-9a-f]{6})$/i)
  if (!match) return null
  const value = match[1]
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  }
}

/** Resolve fill for UI customize tray / pin drawings (hex swatches + canvas-style highlighter). */
export function resolveTrayStrokeFill(
  color: string,
  tool: 'pen' | 'highlighter',
  mode: 'light' | 'dark',
): string {
  if (tool === 'pen') return resolvePenColor(color, mode)
  if (color.startsWith('rgba')) return resolveHighlighterColor(color, mode)
  const rgb = parseHexColor(color)
  if (rgb) {
    const alpha = mode === 'light' ? 0.35 : 0.38
    const rgba = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
    return mode === 'dark' ? boostRgbaForDarkGlow(rgba) : rgba
  }
  return resolveHighlighterColor(color, mode)
}

export function inferTrayStrokeTool(stroke: {
  tool?: 'pen' | 'highlighter'
  opacity?: number
}): 'pen' | 'highlighter' {
  if (stroke.tool === 'highlighter' || stroke.tool === 'pen') return stroke.tool
  if (stroke.opacity != null && stroke.opacity < 1) return 'highlighter'
  return 'pen'
}

import { useEffect, useMemo } from 'react'
import { UI_SATURATION_BOOST } from '../styles/tokens'
import { canvasBackgroundColor, generatePalette } from './paletteGenerator'
import { useThemeStore } from './themeStore'
import { useEffectiveMode } from './useEffectiveMode'

export function useThemeCssVars() {
  const palette = useThemeStore((s) => s.palette)
  const mode = useThemeStore((s) => s.mode)
  const effectiveMode = useEffectiveMode(mode)
  const generated = useMemo(
    () => generatePalette(palette, effectiveMode),
    [palette, effectiveMode],
  )

  useEffect(() => {
    const p = generated
    const root = document.documentElement
    const canvasBg = canvasBackgroundColor(palette, effectiveMode)

    root.style.setProperty('--glass-bg', p.uiGlassBg)
    root.style.setProperty('--glass-border', p.uiGlassBorder)
    root.style.setProperty('--card-bg', p.uiCardBg)
    root.style.setProperty('--ui-text', p.uiText)
    root.style.setProperty('--ui-text-muted', p.uiTextMuted)
    root.style.setProperty('--ui-text-faint', p.uiTextFaint)
    root.style.setProperty('--ui-bg', p.uiBg)
    root.style.setProperty('--ui-accent', p.uiAccent)
    root.style.setProperty(
      '--ui-divider',
      effectiveMode === 'light'
        ? 'rgba(20, 30, 50, 0.06)'
        : 'rgba(255, 255, 255, 0.08)',
    )
    root.style.setProperty(
      '--ui-divider-vertical',
      effectiveMode === 'light'
        ? 'rgba(20, 30, 50, 0.08)'
        : 'rgba(255, 255, 255, 0.1)',
    )
    root.style.setProperty('--vignette', p.vignetteColor)
    root.style.setProperty('--vignette-rgba', p.vignetteRgba)
    root.style.setProperty('--canvas-bg', canvasBg)
    root.style.setProperty(
      '--glass-shadow',
      effectiveMode === 'light'
        ? '0 4px 24px rgba(30, 32, 36, 0.08)'
        : '0 4px 24px rgba(0, 0, 0, 0.35)',
    )
    root.style.setProperty(
      '--card-shadow',
      effectiveMode === 'light'
        ? '0 8px 40px rgba(30, 32, 36, 0.12)'
        : '0 8px 40px rgba(0, 0, 0, 0.4)',
    )
    root.style.setProperty(
      '--pill-icon-halo',
      effectiveMode === 'light' ? '#ffffff' : '#161820',
    )
    root.style.setProperty('--ui-saturate', String(UI_SATURATION_BOOST))
    root.dataset.theme = effectiveMode
  }, [generated, effectiveMode, palette])

  return { palette, effectiveMode, generated }
}

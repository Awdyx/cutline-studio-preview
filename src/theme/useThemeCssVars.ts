import { useEffect, useMemo } from 'react'
import { UI_SATURATION_BOOST } from '../styles/tokens'
import {
  canvasBackgroundColor,
  canvasBlendMidBackgroundColor,
  canvasOuterBackgroundColor,
  canvasVoidBackgroundColor,
  generatePalette,
  panEdgeGlowColor,
} from './paletteGenerator'
import {
  CANVAS_EDGE_BLEED,
  CANVAS_ORIGINAL_HEIGHT,
  CANVAS_ORIGINAL_WIDTH,
  CANVAS_STUDIO_EDGE_FADE,
  CANVAS_VOID_GRID_MASK_INNER_STOP,
  canvasLayoutHeight,
  canvasLayoutWidth,
  FEATURE_PLATE_HEIGHT,
  FEATURE_PLATE_WIDTH,
  STUDIO_CENTRE_CORNER_RADIUS,
  STUDIO_CONTENT_SCALE,
  STUDIO_SURFACE_CORNER_RADIUS,
  STUDIO_VISUAL_HEIGHT,
  STUDIO_VISUAL_WIDTH,
} from '../drawing/canvasDimensions'
import {
  STICKY_DEFAULT_FONT_SIZE,
  TEXT_ITEM_DEFAULT_FONT_SIZE,
} from '../canvasItems/textEditorFontSize'
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
    const canvasOuterBg = canvasOuterBackgroundColor(palette, effectiveMode)
    const canvasBlendMid = canvasBlendMidBackgroundColor(palette, effectiveMode)
    const canvasVoidBg = canvasVoidBackgroundColor(palette, effectiveMode)

    root.style.setProperty('--glass-bg', p.uiGlassBg)
    root.style.setProperty('--glass-border', p.uiGlassBorder)
    root.style.setProperty('--card-bg', p.uiCardBg)
    root.style.setProperty('--chrome-solid-bg', p.uiSolidBg)
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
    root.style.setProperty(
      '--ui-tab-underline',
      effectiveMode === 'light'
        ? 'rgba(26, 34, 48, 0.55)'
        : 'rgba(255, 255, 255, 0.52)',
    )
    root.style.setProperty('--vignette', p.vignetteColor)
    root.style.setProperty('--vignette-rgba', p.vignetteRgba)
    root.style.setProperty('--vignette-rgba-mid', p.vignetteRgbaMid)
    root.style.setProperty('--vignette-rgba-soft', p.vignetteRgbaSoft)
    root.style.setProperty('--vignette-glow-rgba', p.vignetteGlowRgba)
    root.style.setProperty('--canvas-bg', canvasBg)
    root.style.setProperty('--canvas-outer-bg', canvasOuterBg)
    root.style.setProperty('--canvas-blend-mid', canvasBlendMid)
    root.style.setProperty('--canvas-void-bg', canvasVoidBg)
    root.style.setProperty('--pan-edge-glow', panEdgeGlowColor(effectiveMode))
    root.style.setProperty('--canvas-width', `${canvasLayoutWidth()}px`)
    root.style.setProperty('--canvas-height', `${canvasLayoutHeight()}px`)
    root.style.setProperty('--canvas-edge-bleed', `${CANVAS_EDGE_BLEED}px`)
    root.style.setProperty('--canvas-studio-edge-fade', `${CANVAS_STUDIO_EDGE_FADE}px`)
    root.style.setProperty(
      '--canvas-void-grid-mask-inner',
      `${CANVAS_VOID_GRID_MASK_INNER_STOP}%`,
    )
    root.style.setProperty('--studio-centre-radius', `${STUDIO_CENTRE_CORNER_RADIUS}px`)
    root.style.setProperty('--studio-surface-radius', `${STUDIO_SURFACE_CORNER_RADIUS}px`)
    root.style.setProperty('--canvas-studio-w', `${STUDIO_VISUAL_WIDTH}px`)
    root.style.setProperty('--canvas-studio-h', `${STUDIO_VISUAL_HEIGHT}px`)
    root.style.setProperty('--studio-logical-w', `${CANVAS_ORIGINAL_WIDTH}px`)
    root.style.setProperty('--studio-logical-h', `${CANVAS_ORIGINAL_HEIGHT}px`)
    root.style.setProperty('--studio-content-scale', `${STUDIO_CONTENT_SCALE}`)
    root.style.setProperty('--feature-plate-width', `${FEATURE_PLATE_WIDTH}px`)
    root.style.setProperty('--feature-plate-height', `${FEATURE_PLATE_HEIGHT}px`)
    root.style.setProperty(
      '--canvas-text-default-font-size',
      `${TEXT_ITEM_DEFAULT_FONT_SIZE}px`,
    )
    root.style.setProperty(
      '--canvas-sticky-default-font-size',
      `${STICKY_DEFAULT_FONT_SIZE}px`,
    )
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
      '--sticky-rest-shadow',
      effectiveMode === 'light'
        ? '0 2px 10px rgba(20, 30, 50, 0.12)'
        : '0 2px 12px rgba(0, 0, 0, 0.52)',
    )
    root.style.setProperty(
      '--sticky-lift-shadow',
      effectiveMode === 'light'
        ? '0 12px 40px rgba(20, 30, 50, 0.22)'
        : '0 12px 40px rgba(0, 0, 0, 0.62)',
    )
    root.style.setProperty(
      '--pill-icon-halo',
      effectiveMode === 'light' ? '#ffffff' : '#161820',
    )
    root.style.setProperty('--ui-saturate', String(UI_SATURATION_BOOST))
    root.dataset.theme = effectiveMode
    root.style.colorScheme = effectiveMode
    root.style.backgroundColor = canvasVoidBg
    document.body.style.backgroundColor = canvasVoidBg

    let themeColor = document.querySelector('meta[name="theme-color"]')
    if (!themeColor) {
      themeColor = document.createElement('meta')
      themeColor.setAttribute('name', 'theme-color')
      document.head.appendChild(themeColor)
    }
    themeColor.setAttribute('content', canvasVoidBg)
  }, [generated, effectiveMode, palette])

  return { palette, effectiveMode, generated }
}

import {
  HIGHLIGHTER_PRESETS,
  PEN_PRESETS,
  resolveHighlighterColor,
  resolvePenColor,
} from './colorUtils'
import type { PenToolSettingsPanel } from './penToolMenuLayout'
import { useToolStore } from './toolStore'
import { useThemeStore, type ThemeMode } from '../theme/themeStore'
import { useEraserStore, type EraserTargetType } from './useEraserStore'
import { useLassoStore, type LassoTargetType } from './useLassoStore'

function resolveEffectiveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

const COLOR_SETTINGS_ROOT =
  '.pen-tool-pill-settings, .pen-fab-tool-settings, [data-pen-fab-tool-settings]'
const LASSO_SETTINGS_ROOT = '.pen-fab-lasso-panel'
const ERASER_SETTINGS_ROOT = '.pen-fab-eraser-panel'

function settingsRootForPanel(panel: PenToolSettingsPanel): string {
  if (panel === 'lasso') return LASSO_SETTINGS_ROOT
  if (panel === 'erase') return ERASER_SETTINGS_ROOT
  return COLOR_SETTINGS_ROOT
}

function isLassoTargetId(value: string | null): value is LassoTargetType {
  return value === 'strokes' || value === 'sticky' || value === 'text' || value === 'image'
}

function isEraserTargetId(value: string | null): value is EraserTargetType {
  return isLassoTargetId(value)
}

/**
 * Apply the tool-settings control under the pointer (colour swatch, size bar, or lasso target).
 * Used when a hold/drag gesture ends over an open settings panel.
 */
export function applyToolSettingsPickAtPoint(
  clientX: number,
  clientY: number,
  panel: PenToolSettingsPanel,
): boolean {
  const hit = document.elementFromPoint(clientX, clientY)
  if (!(hit instanceof Element)) return false

  const settingsRoot = hit.closest(settingsRootForPanel(panel))
  if (!settingsRoot) return false

  if (panel === 'pen' || panel === 'highlighter') {
    const swatch = hit.closest('[data-tool-color-swatch]')
    if (swatch) {
      const preset = swatch.getAttribute('data-tool-color-swatch')
      if (!preset) return false
      const effectiveMode = resolveEffectiveMode(useThemeStore.getState().mode)
      const store = useToolStore.getState()
      if (panel === 'pen') {
        if (!PEN_PRESETS.includes(preset as (typeof PEN_PRESETS)[number])) return false
        store.setPenColor(resolvePenColor(preset, effectiveMode))
      } else {
        if (!HIGHLIGHTER_PRESETS.includes(preset as (typeof HIGHLIGHTER_PRESETS)[number])) {
          return false
        }
        store.setHighlighterColor(resolveHighlighterColor(preset, effectiveMode))
      }
      return true
    }

    const bar = hit.closest('.tool-settings-size-bar')
    if (bar) {
      const rect = bar.getBoundingClientRect()
      if (rect.width <= 0) return false
      const isPen = panel === 'pen'
      const min = isPen ? 2 : 12
      const max = isPen ? 12 : 32
      const t = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      const size = min + Math.round(t * (max - min))
      const store = useToolStore.getState()
      if (isPen) store.setPenSize(size)
      else store.setHighlighterSize(size)
      return true
    }

    return false
  }

  if (panel === 'lasso') {
    const lassoBtn = hit.closest('[data-lasso-target]')
    if (!lassoBtn) return false
    const id = lassoBtn.getAttribute('data-lasso-target')
    if (!isLassoTargetId(id)) return false

    const { targetTypes, toggleTargetType } = useLassoStore.getState()
    if (targetTypes.length === 1 && targetTypes.includes(id)) return false
    if (!targetTypes.includes(id)) toggleTargetType(id)
    return true
  }

  const eraserBtn = hit.closest('[data-eraser-target]')
  if (!eraserBtn) return false
  const id = eraserBtn.getAttribute('data-eraser-target')
  if (!isEraserTargetId(id)) return false

  const { targetTypes, toggleTargetType } = useEraserStore.getState()
  if (targetTypes.length === 1 && targetTypes.includes(id)) return false
  if (!targetTypes.includes(id)) toggleTargetType(id)
  return true
}

import { useEffect, useRef, useState } from 'react'
import { playSound } from '../sound/playSound'
import type { ThemeMode } from '../theme/themeStore'

export type ThemePulse = {
  id: number
  mode: 'light' | 'dark'
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Ambient SFX + visual pulse when the user explicitly switches light/dark. */
export function useThemeChangeFeedback(
  effectiveMode: 'light' | 'dark',
  themeMode: ThemeMode,
): ThemePulse | null {
  const ready = useRef(false)
  const prev = useRef(effectiveMode)
  const [pulse, setPulse] = useState<ThemePulse | null>(null)

  useEffect(() => {
    if (!ready.current) {
      ready.current = true
      prev.current = effectiveMode
      return
    }
    if (prev.current === effectiveMode) return

    const systemDriven = themeMode === 'auto'
    if (!systemDriven) {
      playSound(effectiveMode === 'light' ? 'themeToLight' : 'themeToDark')
    }

    if (!prefersReducedMotion()) {
      const root = document.documentElement
      root.dataset.themePulse = effectiveMode
      setPulse({ id: performance.now(), mode: effectiveMode })
      const clearPulseAttr = window.setTimeout(() => {
        delete root.dataset.themePulse
      }, 520)
      prev.current = effectiveMode
      return () => window.clearTimeout(clearPulseAttr)
    }

    prev.current = effectiveMode
  }, [effectiveMode, themeMode])

  return pulse
}

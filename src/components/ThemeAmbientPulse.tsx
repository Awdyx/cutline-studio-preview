import { useEffect, useState } from 'react'
import type { ThemePulse } from '../hooks/useThemeChangeFeedback'

const PULSE_MS = 520

type Props = {
  pulse: ThemePulse | null
}

/** Subtle full-viewport wash when theme appearance changes. */
export default function ThemeAmbientPulse({ pulse }: Props) {
  const [active, setActive] = useState<ThemePulse | null>(null)

  useEffect(() => {
    if (!pulse) return
    setActive(pulse)
    const t = window.setTimeout(() => setActive(null), PULSE_MS)
    return () => window.clearTimeout(t)
  }, [pulse])

  if (!active) return null

  return (
    <div
      className={`theme-ambient-pulse theme-ambient-pulse--${active.mode}`}
      aria-hidden
    />
  )
}

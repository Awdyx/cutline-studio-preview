import { motion } from 'framer-motion'
import { isTouchFirstDevice } from './platform/compositor'
import { PAN_EDGE_KEYS, panEdgeOverlayStyle } from './canvas/panEdgeOverlay'
import { usePanMotionStore } from './panMotionStore'
import { useThemeStore } from './theme/themeStore'
import { useEffectiveMode } from './theme/useEffectiveMode'

const EDGE_OPACITY_GAIN = 1.12
const VIGNETTE_OPACITY = 0.5
const VIGNETTE_OPACITY_MAX = 0.62
const DARK_MODE_GLOW_STRENGTH = 0.5

const fadeTransition = (active: boolean) => ({
  duration: active ? 0.55 : 0.22,
  ease: active ? ('easeOut' as const) : ('easeIn' as const),
})

const directionTransition = {
  duration: 0.48,
  ease: 'easeOut' as const,
}

function edgeOpacity(strength: number): number {
  return Math.min(VIGNETTE_OPACITY_MAX, strength * EDGE_OPACITY_GAIN * VIGNETTE_OPACITY)
}

const ZOOM_EDGE_VIGNETTE_GAIN = 0.72

export default function TrailingVignette() {
  const edges = usePanMotionStore((s) => s.edges)
  const zoomEdgeStrength = usePanMotionStore((s) => s.zoomEdgeStrength)
  const themeMode = useThemeStore((s) => s.mode)
  const effectiveMode = useEffectiveMode(themeMode)
  const glowStrength = effectiveMode === 'dark' ? DARK_MODE_GLOW_STRENGTH : 1

  if (isTouchFirstDevice()) return null

  return (
    <>
      {PAN_EDGE_KEYS.map((key) => {
        const strength = Math.max(
          edges[key],
          zoomEdgeStrength * ZOOM_EDGE_VIGNETTE_GAIN,
        )
        const opacity = edgeOpacity(strength) * glowStrength
        const active = strength > 0.02

        return (
          <motion.div
            key={key}
            aria-hidden
            style={panEdgeOverlayStyle(key)}
            initial={false}
            animate={{ opacity: active ? opacity : 0 }}
            transition={active ? directionTransition : fadeTransition(false)}
          />
        )
      })}
    </>
  )
}

import { motion } from 'framer-motion'
import { vignetteIsVisible } from './canvasPanVignette'
import { usePanMotionStore } from './panMotionStore'

const EDGE_KEYS = ['left', 'right', 'top', 'bottom'] as const

const EDGE_OPACITY_GAIN = 1.42
const VIGNETTE_OPACITY = 0.6375

const fadeTransition = (active: boolean) => ({
  duration: active ? 0.55 : 0.45,
  ease: active ? ('easeOut' as const) : ('easeInOut' as const),
})

const directionTransition = {
  duration: 0.48,
  ease: 'easeOut' as const,
}

function edgeGradient(key: (typeof EDGE_KEYS)[number]): string {
  const base = 'var(--vignette-rgba)'
  const mid = 'var(--vignette-rgba-mid)'
  const soft = 'var(--vignette-rgba-soft)'

  switch (key) {
    case 'left':
      return `linear-gradient(to right, ${base} 0%, ${mid} 4%, ${soft} 10%, transparent 22%)`
    case 'right':
      return `linear-gradient(to left, ${base} 0%, ${mid} 4%, ${soft} 10%, transparent 22%)`
    case 'top':
      return `linear-gradient(to bottom, ${base} 0%, ${mid} 4%, ${soft} 10%, transparent 24%)`
    case 'bottom':
      return `linear-gradient(to top, ${base} 0%, ${mid} 4%, ${soft} 10%, transparent 24%)`
  }
}

function edgeOpacity(strength: number): number {
  return Math.min(1, strength * EDGE_OPACITY_GAIN * VIGNETTE_OPACITY)
}

export default function TrailingVignette() {
  const edges = usePanMotionStore((s) => s.edges)
  const visible = vignetteIsVisible(edges)

  return (
    <motion.div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9,
        overflow: 'hidden',
      }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={fadeTransition(visible)}
    >
      {EDGE_KEYS.map((key) => (
        <motion.div
          key={key}
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: edgeGradient(key),
            willChange: 'opacity',
          }}
          animate={{ opacity: edgeOpacity(edges[key]) }}
          transition={
            edges[key] > 0 ? directionTransition : fadeTransition(false)
          }
        />
      ))}
    </motion.div>
  )
}

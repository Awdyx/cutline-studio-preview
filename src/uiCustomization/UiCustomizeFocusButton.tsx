import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { font } from '../styles/tokens'

const BUTTON_SPRING = { type: 'spring' as const, stiffness: 520, damping: 32, mass: 0.45 }

const baseButtonStyle: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  pointerEvents: 'auto',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '10px 18px',
  borderRadius: 999,
  fontFamily: font.family,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  touchAction: 'manipulation',
  border: '1px solid var(--glass-border)',
  background: 'var(--card-bg)',
  boxShadow: 'var(--card-shadow)',
  color: font.colorPrimary,
}

/** Done / clipping pills — shared by chrome UI customize and canvas-item customize. */
export function UiCustomizeFocusButton({
  ariaLabel,
  ariaPressed,
  icon,
  label,
  onClick,
  active = false,
}: {
  ariaLabel: string
  ariaPressed?: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
  active?: boolean
}) {
  const reduceMotion = useReducedMotion()
  const [tapFlash, setTapFlash] = useState(0)
  const [hovered, setHovered] = useState(false)

  return (
    <motion.button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      onPointerDown={(e) => e.stopPropagation()}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation()
        if (!reduceMotion) setTapFlash((n) => n + 1)
        onClick()
      }}
      whileHover={
        reduceMotion
          ? undefined
          : { scale: active ? 1.02 : 1.04, y: active ? -1 : -2 }
      }
      whileTap={reduceMotion ? undefined : { scale: 0.93, y: 0 }}
      animate={
        reduceMotion
          ? undefined
          : {
              borderColor: active ? 'var(--ui-text)' : 'var(--glass-border)',
              backgroundColor: active ? 'var(--ui-text)' : 'var(--card-bg)',
              color: active ? 'var(--card-bg)' : font.colorPrimary,
              boxShadow: hovered
                ? active
                  ? '0 6px 20px rgba(0, 0, 0, 0.22)'
                  : '0 6px 18px rgba(0, 0, 0, 0.14)'
                : 'var(--card-shadow)',
              filter: hovered && !active ? 'brightness(1.04)' : 'brightness(1)',
            }
      }
      transition={{
        ...BUTTON_SPRING,
        backgroundColor: { duration: 0.18, ease: 'easeOut' },
        borderColor: { duration: 0.18, ease: 'easeOut' },
        color: { duration: 0.18, ease: 'easeOut' },
        boxShadow: { duration: 0.16, ease: 'easeOut' },
        filter: { duration: 0.14, ease: 'easeOut' },
      }}
      style={baseButtonStyle}
    >
      {tapFlash > 0 && !reduceMotion && (
        <motion.span
          key={tapFlash}
          aria-hidden
          initial={{ opacity: 0.42, scale: 0.92 }}
          animate={{ opacity: 0, scale: 1.06 }}
          transition={{ duration: 0.34, ease: [0.32, 0.72, 0.32, 1] }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            background: active ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.07)',
            pointerEvents: 'none',
          }}
        />
      )}
      <motion.span
        aria-hidden
        style={{ display: 'inline-flex', alignItems: 'center' }}
        animate={reduceMotion ? undefined : { scale: hovered ? 1.06 : 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 24 }}
      >
        {icon}
      </motion.span>
      <span style={{ position: 'relative' }}>{label}</span>
    </motion.button>
  )
}

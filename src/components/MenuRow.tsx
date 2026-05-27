import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { playSubmenuHover, playSubmenuTap } from '../sound/submenuSound'
import { chromeLabel, font } from '../styles/tokens'
import { useSubmenuSoundScope } from './SubmenuSoundScope'

export function MenuRow({
  icon: Icon,
  label,
  right,
  onClick,
  onMouseEnter,
  submenuSounds,
  submenuClickSound = true,
  dotColor,
  destructive = false,
  disabled = false,
  dimmed = false,
  active = false,
  inset = false,
  compact = false,
  preserveCase = false,
  labelHoverScale = false,
  noHoverFill = false,
}: {
  icon?: React.ElementType
  label: string
  right?: React.ReactNode
  onClick: () => void
  onMouseEnter?: () => void
  /** When omitted, uses SubmenuSoundScope ancestor. */
  submenuSounds?: boolean
  submenuClickSound?: boolean
  dotColor?: string
  destructive?: boolean
  disabled?: boolean
  /** Greyed appearance without blocking clicks (e.g. study shortcut hints). */
  dimmed?: boolean
  active?: boolean
  /** Inset pill row — used in fixed chrome menus. */
  inset?: boolean
  /** Tighter row for phone chrome menus. */
  compact?: boolean
  /** Keep label casing (e.g. HUBS, CHEM) instead of chrome lowercase. */
  preserveCase?: boolean
  /** Scale label on hover — same motion as notification @username links. */
  labelHoverScale?: boolean
  /** Suppress the hover fill pill (e.g. context menus with their own style). */
  noHoverFill?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const [tapNonce, setTapNonce] = useState(0)
  const reduceMotion = useReducedMotion()
  const inSubmenuScope = useSubmenuSoundScope()
  const sounds = submenuSounds ?? inSubmenuScope
  const canInteract = !disabled
  const visuallyMuted = disabled || dimmed
  const showInsetFill = inset && hovered && canInteract

  return (
    <button
      type="button"
      disabled={disabled}
      aria-current={active ? 'page' : undefined}
      onClick={() => {
        if (!canInteract) return
        if (sounds && submenuClickSound) playSubmenuTap()
        if (!reduceMotion) setTapNonce((n) => n + 1)
        onClick()
      }}
      onMouseEnter={() => {
        if (!canInteract) return
        setHovered(true)
        if (sounds) playSubmenuHover()
        onMouseEnter?.()
      }}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        isolation: 'isolate',
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 8 : 10,
        width: inset ? 'calc(100% - 16px)' : '100%',
        margin: inset ? '0 8px' : undefined,
        padding: compact
          ? inset
            ? '7px 10px'
            : '7px 12px'
          : inset
            ? '10px 12px'
            : '10px 16px',
        borderRadius: inset ? 10 : undefined,
        background: showInsetFill ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
        border: 'none',
        outline: 'none',
        cursor: canInteract ? 'pointer' : 'default',
        fontFamily: font.family,
        color: visuallyMuted
          ? font.colorFaint
          : destructive
            ? '#c44e4e'
            : font.colorPrimary,
        transition: 'background 150ms ease',
        textAlign: 'left',
      }}
      className={
        destructive
          ? 'theme-surface canvas-item-z-menu-row canvas-item-z-menu-row--destructive'
          : 'theme-surface'
      }
    >
      {/* Hover fill — same pill shape as active/tap indicators; skipped for inset rows (they use showInsetFill) */}
      {!noHoverFill && !inset && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 3,
            bottom: 3,
            left: 6,
            right: 6,
            zIndex: -1,
            background: destructive ? 'rgba(196, 78, 78, 0.064)' : 'rgba(20, 30, 50, 0.048)',
            borderRadius: 10,
            pointerEvents: 'none',
            opacity: hovered && canInteract ? 1 : 0,
            transition: 'opacity 120ms ease',
          }}
        />
      )}
      <AnimatePresence>
        {active && canInteract && (
          <motion.span
            key="active-highlight"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: 3,
              bottom: 3,
              left: inset ? 0 : 6,
              right: inset ? 0 : 6,
              zIndex: -1,
              background: 'rgba(20, 30, 50, 0.05)',
              borderRadius: 10,
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>
      {tapNonce > 0 && (
        <motion.span
          key={tapNonce}
          aria-hidden
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.25, ease: [0.45, 0, 0.55, 1] }}
          style={{
            position: 'absolute',
            top: 3,
            bottom: 3,
            left: inset ? 0 : 6,
            right: inset ? 0 : 6,
            zIndex: -1,
            background: destructive
              ? 'rgba(196, 78, 78, 0.10)'
              : 'rgba(20, 30, 50, 0.075)',
            borderRadius: 10,
            pointerEvents: 'none',
          }}
        />
      )}
      {dotColor ? (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: dotColor,
            flexShrink: 0,
          }}
        />
      ) : Icon ? (
        <Icon
          size={compact ? 15 : 16}
          strokeWidth={1.8}
          color={
            visuallyMuted
              ? font.colorFaint
              : destructive
                ? '#c44e4e'
                : font.colorMuted
          }
          style={{ flexShrink: 0 }}
        />
      ) : null}
      {labelHoverScale ? (
        <motion.span
          className={preserveCase ? 'ui-chrome-preserve-case' : undefined}
          animate={{ scale: hovered && canInteract && !reduceMotion ? 1.045 : 1 }}
          whileTap={reduceMotion || !canInteract ? undefined : { scale: 0.97 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 420, damping: 32, mass: 0.5 }
          }
          style={{
            flex: 1,
            fontSize: compact ? 13 : 14,
            display: 'inline-block',
            transformOrigin: 'left center',
            minWidth: 0,
          }}
        >
          {preserveCase ? label : chromeLabel(label)}
        </motion.span>
      ) : (
        <span
          className={preserveCase ? 'ui-chrome-preserve-case' : undefined}
          style={{ flex: 1, fontSize: compact ? 13 : 14 }}
        >
          {preserveCase ? label : chromeLabel(label)}
        </span>
      )}
      {right}
    </button>
  )
}

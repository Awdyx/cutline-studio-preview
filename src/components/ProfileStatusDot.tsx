import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { ProfileStatus } from '../profile/types'
import { profileStatusColor, profileStatusDotGlow } from '../profile/profileStatus'

const statusDotTransition = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 30,
  mass: 0.55,
}

function StatusDotCircle({
  status,
  size,
  ringColor,
}: {
  status: ProfileStatus
  size: number
  ringColor?: string
}) {
  const ring = Math.max(2, Math.round(size * 0.28))
  const glow = profileStatusDotGlow(status)

  return (
    <span
      aria-hidden
      style={{
        position: 'relative',
        display: 'block',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: profileStatusColor(status),
        boxShadow: ringColor
          ? [glow, `0 0 0 ${ring}px ${ringColor}`].filter(Boolean).join(', ')
          : glow,
        flexShrink: 0,
      }}
    >
      {status === 'dnd' ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              width: Math.max(4, Math.floor(size * 0.5)),
              height: Math.max(1, Math.round(size * 0.18)),
              borderRadius: 1,
              backgroundColor: '#fff',
              flexShrink: 0,
            }}
          />
        </span>
      ) : null}
    </span>
  )
}

function AnimatedStatusDot({
  status,
  size,
  ringColor,
}: {
  status: ProfileStatus
  size: number
  ringColor?: string
}) {
  const reduceMotion = useReducedMotion()

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={status}
        aria-hidden
        initial={
          reduceMotion
            ? false
            : { scale: 0.45, opacity: 0, filter: 'blur(3px)' }
        }
        animate={
          reduceMotion
            ? undefined
            : { scale: 1, opacity: 1, filter: 'blur(0px)' }
        }
        exit={
          reduceMotion
            ? undefined
            : { scale: 0.55, opacity: 0, filter: 'blur(2px)' }
        }
        transition={
          reduceMotion
            ? { duration: 0 }
            : statusDotTransition
        }
        style={{ display: 'block', lineHeight: 0 }}
      >
        <StatusDotCircle status={status} size={size} ringColor={ringColor} />
      </motion.span>
    </AnimatePresence>
  )
}

export default function ProfileStatusDot({
  status,
  avatarSize = 44,
  placement = 'avatar',
  compact = false,
}: {
  status: ProfileStatus
  avatarSize?: number
  /** `avatar` — bottom-right on profile image; `inline` / `menu` — aligned chrome slots */
  placement?: 'avatar' | 'inline' | 'menu'
  compact?: boolean
}) {
  const dotSize =
    placement === 'inline' || placement === 'menu'
      ? 8
      : Math.max(8, Math.round(avatarSize * 0.23))

  const dot = (
    <AnimatedStatusDot
      status={status}
      size={dotSize}
      ringColor={placement === 'avatar' ? 'var(--card-bg)' : undefined}
    />
  )

  if (placement === 'menu') {
    const iconBox = compact ? 15 : 16
    return (
      <span
        aria-hidden
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: iconBox,
          height: iconBox,
          flexShrink: 0,
        }}
      >
        {dot}
      </span>
    )
  }

  if (placement === 'inline') {
    return (
      <span aria-hidden style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {dot}
      </span>
    )
  }

  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 3,
      }}
    >
      {dot}
    </span>
  )
}

import { useState, type ElementType } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Lock, LockOpen, Moon, Sun } from 'lucide-react'
import { chromeLabel, font } from '../styles/tokens'
import { playSubmenuHover, runSubmenuClick } from '../sound/submenuSound'

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '11px 14px',
  width: '100%',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontFamily: font.family,
  textAlign: 'left',
}

const LABEL_STYLE: React.CSSProperties = {
  flex: 1,
  fontSize: 14,
  color: font.colorPrimary,
}

function IconTrackVisual({
  active,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
}: {
  active: boolean
  leftIcon: ElementType
  rightIcon: ElementType
}) {
  return (
    <span className="chrome-menu-toggle" aria-hidden>
      <LeftIcon
        size={14}
        strokeWidth={2}
        className={`chrome-menu-toggle__side-icon${
          !active ? ' chrome-menu-toggle__side-icon--active' : ''
        }`}
      />
      <RightIcon
        size={14}
        strokeWidth={2}
        className={`chrome-menu-toggle__side-icon${
          active ? ' chrome-menu-toggle__side-icon--active' : ''
        }`}
      />
    </span>
  )
}

function ToggleRowButton({
  icon: Icon,
  label,
  active,
  onChange,
  ariaLabel,
  className = 'chrome-menu-toggle-row',
  disabled = false,
  playClickSound = true,
  trackLeftIcon,
  trackRightIcon,
  labelClassName,
  labelStyle = LABEL_STYLE,
}: {
  icon?: ElementType
  label: string
  active: boolean
  onChange: (next: boolean) => void
  ariaLabel: string
  className?: string
  disabled?: boolean
  playClickSound?: boolean
  trackLeftIcon: ElementType
  trackRightIcon: ElementType
  labelClassName?: string
  labelStyle?: React.CSSProperties
}) {
  const [hovered, setHovered] = useState(false)
  const reduceMotion = useReducedMotion()

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={className}
      style={ROW_STYLE}
      onMouseEnter={() => {
        if (!disabled) { setHovered(true); playSubmenuHover() }
      }}
      onMouseLeave={() => setHovered(false)}
      onClick={() => {
        if (disabled) return
        runSubmenuClick(() => onChange(!active), playClickSound)
      }}
    >
      {Icon ? <RowIcon icon={Icon} /> : null}
      <motion.span
        className={labelClassName}
        animate={{ scale: hovered && !disabled && !reduceMotion ? 1.045 : 1 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: 'spring', stiffness: 420, damping: 32, mass: 0.5 }
        }
        style={{
          ...(labelClassName ? undefined : labelStyle),
          display: 'inline-block',
          transformOrigin: 'left center',
        }}
      >
        {chromeLabel(label)}
      </motion.span>
      <IconTrackVisual
        active={active}
        leftIcon={trackLeftIcon}
        rightIcon={trackRightIcon}
      />
    </button>
  )
}

function lockRowClassName(disabled: boolean): string {
  return disabled
    ? 'chrome-menu-toggle-row chrome-menu-toggle-row--dimmed'
    : 'chrome-menu-toggle-row'
}

function RowIcon({ icon: Icon }: { icon: ElementType }) {
  return (
    <Icon
      size={16}
      strokeWidth={1.8}
      color={font.colorMuted}
      style={{ flexShrink: 0 }}
      aria-hidden
    />
  )
}

export default function MenuToggleRow({
  icon: Icon,
  label,
  enabled,
  onChange,
  trackLeftIcon,
  trackRightIcon,
  playClickSound = true,
}: {
  icon?: ElementType
  label: string
  enabled: boolean
  onChange: (next: boolean) => void
  trackLeftIcon: ElementType
  trackRightIcon: ElementType
  playClickSound?: boolean
}) {
  return (
    <ToggleRowButton
      icon={Icon}
      label={label}
      active={enabled}
      onChange={onChange}
      ariaLabel={label}
      playClickSound={playClickSound}
      trackLeftIcon={trackLeftIcon}
      trackRightIcon={trackRightIcon}
    />
  )
}

export function LockToggleRow({
  icon: Icon,
  locked,
  onChange,
  disabled = false,
}: {
  icon?: ElementType
  locked: boolean
  onChange: (locked: boolean) => void
  disabled?: boolean
}) {
  return (
    <ToggleRowButton
      icon={Icon}
      label="Canvas lock"
      active={locked}
      onChange={onChange}
      ariaLabel="Canvas lock"
      className={lockRowClassName(disabled)}
      disabled={disabled}
      trackLeftIcon={LockOpen}
      trackRightIcon={Lock}
      labelClassName="chrome-menu-toggle-row__label"
    />
  )
}

export function ThemeToggleRow({
  icon: Icon,
  dark,
  onChange,
}: {
  icon?: ElementType
  dark: boolean
  onChange: (dark: boolean) => void
}) {
  return (
    <ToggleRowButton
      icon={Icon}
      label="Theme"
      active={dark}
      onChange={onChange}
      ariaLabel="Theme"
      trackLeftIcon={Sun}
      trackRightIcon={Moon}
    />
  )
}

import { useState } from 'react'
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
  active = false,
  inset = false,
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
  active?: boolean
  /** Inset pill row — used in fixed chrome menus. */
  inset?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const inSubmenuScope = useSubmenuSoundScope()
  const sounds = submenuSounds ?? inSubmenuScope
  const canInteract = !disabled
  const showInsetFill = inset && hovered && canInteract

  return (
    <button
      type="button"
      disabled={disabled}
      aria-current={active ? 'page' : undefined}
      onClick={() => {
        if (!canInteract) return
        if (sounds && submenuClickSound) playSubmenuTap()
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
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: inset ? 'calc(100% - 16px)' : '100%',
        margin: inset ? '0 8px' : undefined,
        padding: inset ? '10px 12px' : '10px 16px',
        borderRadius: inset ? 10 : undefined,
        background: showInsetFill ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
        border: 'none',
        cursor: canInteract ? 'pointer' : 'default',
        fontFamily: font.family,
        color: disabled
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
          size={16}
          strokeWidth={1.8}
          color={
            disabled
              ? font.colorFaint
              : destructive
                ? '#c44e4e'
                : font.colorMuted
          }
          style={{ flexShrink: 0 }}
        />
      ) : null}
      <span style={{ flex: 1, fontSize: 14 }}>{chromeLabel(label)}</span>
      {right}
    </button>
  )
}

import { useState } from 'react'
import { X } from 'lucide-react'
import { playSubmenuHover, runSubmenuClick } from '../sound/submenuSound'
import { menuDividerStyle } from '../styles/tokens'
import { useThemeStore } from '../theme/themeStore'
import { useEffectiveMode } from '../theme/useEffectiveMode'
import { useCanvasItemsStore } from './canvasItemsStore'
import { resolveSpaceTintSwatchColor } from './spaceTint'
import type { SpaceTintId } from './types'

const TINT_OPTIONS: { id: SpaceTintId; label: string }[] = [
  { id: 'yellow', label: 'Yellow tint' },
  { id: 'pink', label: 'Pink tint' },
  { id: 'blue', label: 'Blue tint' },
  { id: 'green', label: 'Green tint' },
]

function TintSwatch({
  tintId,
  active,
  label,
  swatchColor,
  onClick,
  disabled = false,
}: {
  tintId: SpaceTintId
  active: boolean
  label: string
  swatchColor: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      aria-disabled={disabled || undefined}
      onMouseEnter={() => {
        if (disabled) return
        playSubmenuHover()
      }}
      onClick={() => {
        if (disabled) return
        runSubmenuClick(onClick)
      }}
      style={{
        width: 26,
        height: 26,
        flexShrink: 0,
        borderRadius: '50%',
        background: swatchColor,
        border: active
          ? '2px solid var(--ui-text)'
          : '1.5px solid rgba(255, 255, 255, 0.85)',
        boxShadow: active
          ? 'inset 0 0 0 1px rgba(255, 255, 255, 0.35)'
          : '0 1px 2px rgba(0, 0, 0, 0.08)',
        cursor: disabled ? 'default' : 'pointer',
        padding: 0,
        outline: 'none',
        transition: 'border-color 150ms ease, box-shadow 150ms ease',
      }}
    />
  )
}

function ClearTintButton({
  active,
  disabled,
  onClick,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const canInteract = !disabled
  const bg = active && canInteract
    ? 'var(--menu-row-toggle-active-bg)'
    : hovered && canInteract
      ? 'var(--menu-row-hover-fill)'
      : 'transparent'

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label="No tint"
      aria-pressed={active}
      aria-disabled={disabled || undefined}
      onMouseEnter={() => {
        if (!canInteract) return
        setHovered(true)
        playSubmenuHover()
      }}
      onMouseLeave={() => setHovered(false)}
      onClick={() => {
        if (!canInteract) return
        runSubmenuClick(onClick)
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 28,
        border: 'none',
        borderRadius: 8,
        background: bg,
        cursor: canInteract ? 'pointer' : 'default',
        color: 'var(--ui-text-muted)',
        transition: 'background 120ms ease',
      }}
    >
      <X size={14} strokeWidth={2.25} aria-hidden />
    </button>
  )
}

export default function SpaceTintMenuSection({
  itemId,
  currentTint,
}: {
  itemId: string
  currentTint: SpaceTintId | undefined
}) {
  const setSpaceTint = useCanvasItemsStore((s) => s.setSpaceTint)
  const themeMode = useThemeStore((s) => s.mode)
  const effectiveMode = useEffectiveMode(themeMode)
  const colorsDisabled = effectiveMode === 'dark'

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          padding: '6px 6px 10px',
          opacity: colorsDisabled ? 0.48 : 1,
          transition: 'opacity 120ms ease',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: 4,
            borderRadius: 999,
            background: 'var(--tool-settings-swatch-track-bg)',
          }}
        >
          {TINT_OPTIONS.map(({ id, label }) => (
            <TintSwatch
              key={id}
              tintId={id}
              active={currentTint === id}
              label={label}
              swatchColor={resolveSpaceTintSwatchColor(id)}
              disabled={colorsDisabled}
              onClick={() => setSpaceTint(itemId, id)}
            />
          ))}
        </div>
        <ClearTintButton
          active={currentTint == null}
          disabled={colorsDisabled}
          onClick={() => setSpaceTint(itemId, undefined)}
        />
      </div>
      <div style={{ ...menuDividerStyle, margin: '0 10px 4px' }} />
    </>
  )
}

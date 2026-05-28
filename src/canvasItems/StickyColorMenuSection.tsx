import { useState } from 'react'
import { playSubmenuHover, runSubmenuClick } from '../sound/submenuSound'
import { menuDividerStyle } from '../styles/tokens'
import { STICKY_SWATCH_COLORS } from '../theme/paletteGenerator'
import { useThemeStore } from '../theme/themeStore'
import { useEffectiveMode } from '../theme/useEffectiveMode'
import { useCanvasItemsStore } from './canvasItemsStore'
import type { StickyColorId } from './types'

const COLOR_OPTIONS: { id: StickyColorId; label: string }[] = [
  { id: 'yellow', label: 'Yellow' },
  { id: 'pink', label: 'Pink' },
  { id: 'blue', label: 'Blue' },
]

function ColorSwatch({
  colorId,
  active,
  label,
  onClick,
  disabled = false,
}: {
  colorId: StickyColorId
  active: boolean
  label: string
  onClick: () => void
  disabled?: boolean
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
      aria-label={label}
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
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px 0',
        border: 'none',
        borderRadius: 8,
        background: bg,
        cursor: canInteract ? 'pointer' : 'default',
        transition: 'background 120ms ease',
      }}
    >
      <span
        style={{
          display: 'block',
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: STICKY_SWATCH_COLORS[colorId],
          boxShadow: active && canInteract
            ? '0 0 0 1.5px var(--menu-row-toggle-active-bg), 0 0 0 2px rgba(0,0,0,0.35)'
            : '0 0 0 1.5px rgba(0,0,0,0.12)',
          flexShrink: 0,
          transition: 'box-shadow 120ms ease',
        }}
      />
    </button>
  )
}

export default function StickyColorMenuSection({
  itemId,
  currentColor,
}: {
  itemId: string
  currentColor: StickyColorId | undefined
}) {
  const setStickyColor = useCanvasItemsStore((s) => s.setStickyColor)
  const themeMode = useThemeStore((s) => s.mode)
  const effectiveMode = useEffectiveMode(themeMode)
  const colorsDisabled = effectiveMode === 'dark'
  const active = currentColor ?? 'yellow'

  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '6px 6px 10px',
          opacity: colorsDisabled ? 0.48 : 1,
          transition: 'opacity 120ms ease',
        }}
      >
        {COLOR_OPTIONS.map(({ id, label }) => (
          <ColorSwatch
            key={id}
            colorId={id}
            active={active === id}
            label={label}
            disabled={colorsDisabled}
            onClick={() => setStickyColor(itemId, id === 'yellow' ? undefined : id)}
          />
        ))}
      </div>
      <div style={{ ...menuDividerStyle, margin: '0 10px 4px' }} />
    </>
  )
}

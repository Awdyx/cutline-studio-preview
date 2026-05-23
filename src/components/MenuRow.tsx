import { useState } from 'react'
import { chromeLabel, font } from '../styles/tokens'

export function MenuRow({
  icon: Icon,
  label,
  right,
  onClick,
  onMouseEnter,
}: {
  icon: React.ElementType
  label: string
  right?: React.ReactNode
  onClick: () => void
  onMouseEnter?: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => {
        setHovered(true)
        onMouseEnter?.()
      }}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '10px 16px',
        background: hovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontFamily: font.family,
        color: font.colorPrimary,
        transition: 'background 150ms ease',
      }}
      className="theme-surface"
    >
      <Icon size={16} strokeWidth={1.8} color={font.colorMuted} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 14, textAlign: 'left' }}>{chromeLabel(label)}</span>
      {right}
    </button>
  )
}

import { ArrowLeft } from 'lucide-react'
import { playSubmenuTap } from '../sound/submenuSound'
import { font } from '../styles/tokens'

interface PhoneStackHeaderProps {
  title: string
  onBack: () => void
}

export default function PhoneStackHeader({ title, onBack }: PhoneStackHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 12px 8px',
        borderBottom: '1px solid var(--ui-divider)',
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        aria-label="Back"
        onClick={() => {
          playSubmenuTap()
          onBack()
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          border: 'none',
          borderRadius: 10,
          background: 'transparent',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <ArrowLeft size={18} strokeWidth={2} color={font.colorPrimary} />
      </button>
      <span
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: font.colorPrimary,
          fontFamily: font.family,
        }}
      >
        {title}
      </span>
    </div>
  )
}

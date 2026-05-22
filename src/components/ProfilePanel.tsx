import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { User, Settings, CreditCard, HelpCircle, LogOut } from 'lucide-react'
import { card, font } from '../styles/tokens'

type ProfileDestination = 'profile' | 'preferences' | 'subscription' | 'help'

interface ProfilePanelProps {
  isOpen: boolean
  onClose: () => void
  user: { name: string; email: string; initial: string; avatarColor: string }
  onNavigate: (destination: ProfileDestination) => void
  onSignOut: () => void
}

const cardBase: React.CSSProperties = {
  position: 'fixed',
  top: 64,
  right: 16,
  width: 280,
  background: card.bg,
  backdropFilter: card.blur,
  WebkitBackdropFilter: card.blur,
  border: card.border,
  boxShadow: card.shadow,
  borderRadius: card.radius,
  fontFamily: font.family,
  color: font.colorPrimary,
  zIndex: 30,
  overflow: 'hidden',
}

const divider: React.CSSProperties = {
  height: 1,
  background: 'rgba(20, 30, 50, 0.07)',
  margin: '4px 0',
}

const NAV_ITEMS: {
  icon: React.ElementType
  label: string
  destination: ProfileDestination
}[] = [
  { icon: User, label: 'Profile', destination: 'profile' },
  { icon: Settings, label: 'Preferences', destination: 'preferences' },
  { icon: CreditCard, label: 'Subscription', destination: 'subscription' },
  { icon: HelpCircle, label: 'Help & support', destination: 'help' },
]

function NavRow({
  icon: Icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
  danger?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '9px 16px',
        background: hovered ? 'rgba(20, 30, 50, 0.04)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: font.family,
        transition: 'background 150ms ease',
      }}
    >
      <Icon
        size={15}
        strokeWidth={1.8}
        color={danger ? '#c0392b' : font.colorMuted}
        style={{ flexShrink: 0 }}
      />
      <span
        style={{
          fontSize: 14,
          fontWeight: 400,
          color: danger ? '#c0392b' : font.colorPrimary,
        }}
      >
        {label}
      </span>
    </button>
  )
}

export default function ProfilePanel({
  isOpen,
  onClose,
  user,
  onNavigate,
  onSignOut,
}: ProfilePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handleMouseDown(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !(e.target as Element).closest('[data-panel-trigger="profile"]')
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isOpen, onClose])

  return (
    <motion.div
      ref={panelRef}
      style={cardBase}
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -4 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '20px 16px 16px',
          gap: 8,
        }}
      >
        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            backgroundColor: user.avatarColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            fontWeight: 700,
            color: '#fff',
            letterSpacing: '0.02em',
          }}
        >
          {user.initial}
        </span>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{user.name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: font.colorMuted }}>
            {user.email}
          </p>
        </div>
      </div>

      <div style={divider} />

      {/* Nav */}
      <div style={{ padding: '4px 0' }}>
        {NAV_ITEMS.map(({ icon, label, destination }) => (
          <NavRow
            key={destination}
            icon={icon}
            label={label}
            onClick={() => onNavigate(destination)}
          />
        ))}
      </div>

      <div style={divider} />

      {/* Footer */}
      <div style={{ padding: '4px 0 8px' }}>
        <NavRow icon={LogOut} label="Sign out" onClick={onSignOut} danger />
      </div>
    </motion.div>
  )
}

import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, CreditCard, HelpCircle, LogOut } from 'lucide-react'
import {
  CHROME_CARD_CLASS,
  CHROME_PRESERVE_CASE_CLASS,
  card,
  chromeLabel,
  font,
  menuDividerStyle,
} from '../styles/tokens'
import type { UserProfile } from '../profile/types'
import UserAvatar from './UserAvatar'
import ProfileIdentityTags from './ProfileIdentityTags'
import ProfileSubmenu from './ProfileSubmenu'
import SubscriptionSubmenu from './SubscriptionSubmenu'

type ProfileDestination = 'profile' | 'subscription' | 'help'
type ProfileSubmenuId = 'profile' | 'subscription'

interface ProfilePanelProps {
  isOpen: boolean
  onClose: () => void
  user: UserProfile
  onNavigate: (destination: ProfileDestination) => void
  onSignOut: () => void
  onManageBilling?: () => void
  onChangePlan?: () => void
}

const cardBase: React.CSSProperties = {
  position: 'fixed',
  top: 64,
  right: 16,
  width: 280,
  background: card.bg,
  border: card.border,
  boxShadow: card.shadow,
  borderRadius: card.radius,
  fontFamily: font.family,
  color: font.colorPrimary,
  zIndex: 30,
  overflow: 'hidden',
}

const NAV_ITEMS: {
  icon: React.ElementType
  label: string
  destination: ProfileDestination
}[] = [
  { icon: User, label: 'Profile', destination: 'profile' },
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
      type="button"
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
        {chromeLabel(label)}
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
  onManageBilling,
  onChangePlan,
}: ProfilePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [openSubmenu, setOpenSubmenu] = useState<ProfileSubmenuId | null>(null)

  useEffect(() => {
    if (!isOpen) setOpenSubmenu(null)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Element
      if (target.closest('[data-profile-submenu]')) return
      if (target.closest('[data-profile-save-bubble]')) return
      if (target.closest('[data-subscription-submenu]')) return
      if (target.closest('[data-panel-trigger="profile"]')) return
      if (panelRef.current && !panelRef.current.contains(target)) {
        setOpenSubmenu(null)
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isOpen, onClose])

  const handleNav = (destination: ProfileDestination) => {
    if (destination === 'profile') {
      setOpenSubmenu((current) => (current === 'profile' ? null : 'profile'))
      return
    }
    if (destination === 'subscription') {
      setOpenSubmenu((current) => (current === 'subscription' ? null : 'subscription'))
      return
    }
    setOpenSubmenu(null)
    onNavigate(destination)
  }

  return (
    <>
      <motion.div
        ref={panelRef}
        className={`theme-surface ${CHROME_CARD_CLASS}`}
        style={cardBase}
        initial={{ opacity: 0, scale: 0.96, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -4 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '20px 16px 16px',
            gap: 8,
          }}
        >
          <UserAvatar
            displayName={user.displayName}
            avatarColor={user.avatarColor}
            avatarImageUrl={user.avatarImageUrl}
            size={44}
            fontSize={18}
          />
          <div className={CHROME_PRESERVE_CASE_CLASS}>
            <ProfileIdentityTags
              displayName={user.displayName}
              handle={user.handle}
              studentCohort={user.studentCohort}
            />
            <div style={{ textAlign: 'center', width: '100%' }}>
              {user.bio && (
                <p
                  style={{
                    margin: '8px 0 0',
                    fontSize: 12,
                    color: font.colorFaint,
                    lineHeight: 1.4,
                    maxWidth: 240,
                  }}
                >
                  {user.bio}
                </p>
              )}
            </div>
          </div>
        </div>

        <div style={menuDividerStyle} />

        <div style={{ padding: '4px 0' }}>
          {NAV_ITEMS.map(({ icon, label, destination }) => {
            const row = (
              <NavRow
                icon={icon}
                label={label}
                onClick={() => handleNav(destination)}
              />
            )
            return <div key={destination}>{row}</div>
          })}
        </div>

        <div style={menuDividerStyle} />

        <div style={{ padding: '4px 0 8px' }}>
          <NavRow icon={LogOut} label="Sign out" onClick={onSignOut} danger />
        </div>
      </motion.div>

      <AnimatePresence>
        {openSubmenu === 'profile' && (
          <ProfileSubmenu
            key="profile-submenu"
            panelRef={panelRef}
            onClose={() => setOpenSubmenu(null)}
          />
        )}
        {openSubmenu === 'subscription' && (
          <SubscriptionSubmenu
            key="subscription-submenu"
            panelRef={panelRef}
            onClose={() => setOpenSubmenu(null)}
            onManageBilling={onManageBilling}
            onChangePlan={onChangePlan}
          />
        )}
      </AnimatePresence>
    </>
  )
}

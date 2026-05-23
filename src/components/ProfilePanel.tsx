import { useCallback, useRef, useEffect, useState } from 'react'
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
import { useProfileStore } from '../profile/profileStore'
import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'
import ProfileBannerHeader from './ProfileBannerHeader'
import ProfileIdentityTags from './ProfileIdentityTags'
import ProfileSocialPills from './ProfileSocialPills'
import ProfileSubmenu from './ProfileSubmenu'
import SubscriptionSubmenu from './SubscriptionSubmenu'
import { useMenuOutsideDismiss } from './useMenuOutsideDismiss'
import { useVisualViewportOffset } from '../platform/useVisualViewportOffset'
import { playSubmenuHover, playSubmenuTap } from '../sound/submenuSound'

type ProfileDestination = 'profile' | 'subscription' | 'help'
type ProfileSubmenuId = 'profile' | 'subscription'

interface ProfilePanelProps {
  isOpen: boolean
  onClose: () => void
  onNavigate: (destination: ProfileDestination) => void
  onSignOut: () => void
  onManageBilling?: () => void
  onChangePlan?: () => void
}

const PROFILE_PANEL_TOP = 64

const cardBase: React.CSSProperties = {
  position: 'fixed',
  top: PROFILE_PANEL_TOP,
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
      onClick={() => {
        playSubmenuTap()
        onClick()
      }}
      onMouseEnter={() => {
        setHovered(true)
        playSubmenuHover()
      }}
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
  onNavigate,
  onSignOut,
  onManageBilling,
  onChangePlan,
}: ProfilePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [openSubmenu, setOpenSubmenu] = useState<ProfileSubmenuId | null>(null)
  const profile = useProfileStore((s) => s.profile)
  const visualViewportOffsetTop = useVisualViewportOffset()

  const closeAllSubmenus = useCallback(() => {
    setOpenSubmenu(null)
  }, [])

  useEffect(() => {
    if (!isOpen) closeAllSubmenus()
  }, [closeAllSubmenus, isOpen])

  useEffect(() => {
    useShortcutUiStore.getState().registerProfileMenu({ closeSubmenus: closeAllSubmenus })
    return () => useShortcutUiStore.getState().registerProfileMenu(null)
  }, [closeAllSubmenus])

  const dismissFromOutside = useCallback(
    (target: Element) => {
      if (target.closest('[data-panel-trigger]')) {
        closeAllSubmenus()
        return
      }
      if (panelRef.current?.contains(target)) {
        closeAllSubmenus()
        return
      }
      closeAllSubmenus()
      onClose()
    },
    [closeAllSubmenus, onClose],
  )

  useMenuOutsideDismiss({
    active: isOpen,
    panelRef,
    onDismiss: dismissFromOutside,
    isInside: (target) =>
      !!target.closest('[data-profile-submenu]') ||
      !!target.closest('[data-profile-save-bubble]') ||
      !!target.closest('[data-subscription-submenu]'),
    dismissInsidePanel: openSubmenu !== null,
  })

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
        style={{ ...cardBase, top: PROFILE_PANEL_TOP + visualViewportOffsetTop }}
        initial={{ opacity: 0, scale: 0.96, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -4 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <div>
          <ProfileBannerHeader
            bannerImageUrl={profile.bannerImageUrl}
            displayName={profile.displayName}
            avatarColor={profile.avatarColor}
            avatarImageUrl={profile.avatarImageUrl}
            edgeToEdge
          >
            <div className={CHROME_PRESERVE_CASE_CLASS}>
              <ProfileIdentityTags
                displayName={profile.displayName}
                handle={profile.handle}
                studentCohort={profile.studentCohort}
              />
              {profile.bio && (
                <p
                  style={{
                    margin: '16px 0 0',
                    fontSize: 12,
                    color: font.colorFaint,
                    lineHeight: 1.45,
                  }}
                >
                  {profile.bio}
                </p>
              )}
              <ProfileSocialPills socials={profile.socials} centered />
            </div>
          </ProfileBannerHeader>
        </div>

        <div style={menuDividerStyle} />

        <div style={{ padding: '4px 0' }}>
          {NAV_ITEMS.map(({ icon, label, destination }) => (
            <NavRow
              key={destination}
              icon={icon}
              label={label}
              onClick={() => handleNav(destination)}
            />
          ))}
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

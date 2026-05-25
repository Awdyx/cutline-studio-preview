import { useCallback, useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, CreditCard, HelpCircle, LogOut } from 'lucide-react'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import { CHROME_FROSTED_MENU_CLASS, CHROME_PRESERVE_CASE_CLASS, chromeFrostedMenuStyle, chromeLabel, font, menuDividerStyle } from '../styles/tokens'
import { phonePanelSheetStyle, phoneSubmenuSlideMotion } from '../styles/phoneChrome'
import { useProfileStore } from '../profile/profileStore'
import type { UserProfile } from '../profile/types'
import { isProfileFilePickerOpen } from '../profile/profileFilePickerSession'
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
  ...chromeFrostedMenuStyle,
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
  const isPhone = useIsPhoneLayout()
  const panelRef = useRef<HTMLDivElement>(null)
  const [openSubmenu, setOpenSubmenu] = useState<ProfileSubmenuId | null>(null)
  const [profileDraft, setProfileDraft] = useState<UserProfile | null>(null)
  const profile = useProfileStore((s) => s.profile)
  const visualViewportOffsetTop = useVisualViewportOffset()

  const closeProfileSubmenu = useCallback(() => {
    setProfileDraft(null)
    setOpenSubmenu((current) => (current === 'profile' ? null : current))
  }, [])

  const closeAllSubmenus = useCallback(() => {
    setProfileDraft(null)
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
      if (openSubmenu === 'profile' && target.closest('[data-profile-panel-header]')) {
        return
      }
      if (panelRef.current?.contains(target)) {
        closeAllSubmenus()
        return
      }
      closeAllSubmenus()
      onClose()
    },
    [closeAllSubmenus, onClose, openSubmenu],
  )

  useMenuOutsideDismiss({
    active: isOpen,
    panelRef,
    onDismiss: dismissFromOutside,
    isInside: (target) =>
      isProfileFilePickerOpen() ||
      !!target.closest('[data-profile-submenu]') ||
      !!target.closest('[data-profile-save-bubble]') ||
      !!target.closest('[data-subscription-submenu]'),
    dismissInsidePanel: openSubmenu !== null,
  })

  const handleNav = (destination: ProfileDestination) => {
    if (destination === 'profile') {
      setOpenSubmenu((current) => {
        if (current === 'profile') {
          setProfileDraft(null)
          return null
        }
        return 'profile'
      })
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
        className={`theme-surface ${CHROME_FROSTED_MENU_CLASS}`}
        style={{
          ...(isPhone
            ? phonePanelSheetStyle(undefined, 'right')
            : { ...cardBase, top: PROFILE_PANEL_TOP + visualViewportOffsetTop }),
          ...chromeFrostedMenuStyle,
          fontFamily: font.family,
          color: font.colorPrimary,
          zIndex: 30,
          overflow: isPhone ? 'auto' : 'hidden',
        }}
        {...(isPhone ? phoneSubmenuSlideMotion : {
          initial: { opacity: 0, scale: 0.96, y: -4 },
          animate: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0, scale: 0.96, y: -4 },
          transition: { duration: 0.18, ease: 'easeOut' },
        })}
      >
        <div data-profile-panel-header>
          <ProfileBannerHeader
            bannerImageUrl={profileDraft?.bannerImageUrl ?? profile.bannerImageUrl}
            bannerFrame={profileDraft?.bannerFrame ?? profile.bannerFrame}
            displayName={profileDraft?.displayName ?? profile.displayName}
            avatarColor={profile.avatarColor}
            avatarImageUrl={profileDraft?.avatarImageUrl ?? profile.avatarImageUrl}
            avatarFrame={profileDraft?.avatarFrame ?? profile.avatarFrame}
            edgeToEdge
          >
            <div className={CHROME_PRESERVE_CASE_CLASS}>
              <ProfileIdentityTags
                displayName={profileDraft?.displayName ?? profile.displayName}
                handle={profileDraft?.handle ?? profile.handle}
                studentCohort={profile.studentCohort}
              />
              {(profileDraft?.bio ?? profile.bio) && (
                <p
                  style={{
                    margin: '16px 0 0',
                    fontSize: 12,
                    color: font.colorFaint,
                    lineHeight: 1.45,
                  }}
                >
                  {profileDraft?.bio ?? profile.bio}
                </p>
              )}
              <ProfileSocialPills socials={profileDraft?.socials ?? profile.socials} centered />
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
            onClose={closeProfileSubmenu}
            onDraftChange={setProfileDraft}
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

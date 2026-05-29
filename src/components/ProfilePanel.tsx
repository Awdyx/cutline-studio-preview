import { useCallback, useRef, useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { User, CreditCard, HelpCircle, LogOut, Signal } from 'lucide-react'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import { CHROME_FROSTED_MENU_CLASS, CHROME_PRESERVE_CASE_CLASS, chromeFrostedMenuStyle, font, menuDividerStyle, phoneMenuDividerStyle } from '../styles/tokens'
import {
  phonePanelSheetStyle,
  phoneTopMenuMaxHeight,
  phoneTopPanelSlideMotion,
  phoneTopPanelTransformOrigin,
  PHONE_TOP_PANEL_SCALE,
} from '../styles/phoneChrome'
import { useProfileStore } from '../profile/profileStore'
import { profileEditFieldsChanged } from '../profile/profileUtils'
import type { UserProfile } from '../profile/types'
import { isProfileFilePickerOpen } from '../profile/profileFilePickerSession'
import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'
import ProfileBannerHeader from './ProfileBannerHeader'
import ProfileIdentityTags from './ProfileIdentityTags'
import ProfileSocialPills from './ProfileSocialPills'
import ProfileSubmenu from './ProfileSubmenu'
import SubscriptionSubmenu from './SubscriptionSubmenu'
import { cycleProfileStatus, profileStatusShortLabel } from '../profile/profileStatus'
import ProfilePinnedTrack from '../music/ProfilePinnedTrack'
import { MenuRow } from './MenuRow'
import { SubmenuSoundScope } from './SubmenuSoundScope'
import { useMenuOutsideDismiss } from './useMenuOutsideDismiss'
import { useVisualViewportOffset } from '../platform/useVisualViewportOffset'

type ProfileDestination = 'profile' | 'subscription' | 'help'
type ProfileSubmenuId = 'profile' | 'subscription'

interface ProfilePanelProps {
  isOpen: boolean
  onClose: () => void
  onNavigate: (destination: ProfileDestination) => void
  onSignOut: () => void
}

const PROFILE_PANEL_TOP = 64
const HELP_TAUNT_GAP = 12
const HELP_TAUNT_TEXT = "we aren't a corporation just text us"

const headerContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.03 },
  },
}

const headerItemVariants = {
  hidden: { opacity: 0, y: 5, scale: 0.965 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 360, damping: 34, mass: 0.85 },
  },
}

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
  { icon: User, label: 'Edit profile', destination: 'profile' },
  { icon: CreditCard, label: 'Subscription', destination: 'subscription' },
  { icon: HelpCircle, label: 'Help & support', destination: 'help' },
]

export default function ProfilePanel({
  isOpen,
  onClose,
  onNavigate,
  onSignOut,
}: ProfilePanelProps) {
  const isPhone = useIsPhoneLayout()
  const panelRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const helpRowRef = useRef<HTMLDivElement>(null)
  const [phoneContentFillScale, setPhoneContentFillScale] = useState(1)
  const [openSubmenu, setOpenSubmenu] = useState<ProfileSubmenuId | null>(null)
  const [profileDraft, setProfileDraft] = useState<UserProfile | null>(null)
  const [showHelpTaunt, setShowHelpTaunt] = useState(false)
  const [helpTauntPos, setHelpTauntPos] = useState<{ y: number; left: number } | null>(null)
  const helpTauntTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const profile = useProfileStore((s) => s.profile)
  const saveProfile = useProfileStore((s) => s.saveProfile)
  const visualViewportOffsetTop = useVisualViewportOffset()
  const hasMountedRef = useRef(false)
  const prevProfileRef = useRef(profile)
  const [savedVersion, setSavedVersion] = useState(0)

  useEffect(() => {
    const prev = prevProfileRef.current
    prevProfileRef.current = profile
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    if (profileEditFieldsChanged(prev, profile)) {
      setSavedVersion((v) => v + 1)
    }
  }, [profile])

  const closeProfileSubmenu = useCallback(() => {
    setProfileDraft(null)
    setOpenSubmenu((current) => (current === 'profile' ? null : current))
  }, [])

  const closeAllSubmenus = useCallback(() => {
    setProfileDraft(null)
    setOpenSubmenu(null)
  }, [])

  const updateHelpTauntPos = useCallback(() => {
    const row = helpRowRef.current
    if (!row) return
    const rect = row.getBoundingClientRect()
    setHelpTauntPos({ y: rect.top + rect.height / 2, left: rect.left })
  }, [])

  useEffect(() => {
    if (!isOpen) {
      closeAllSubmenus()
      if (helpTauntTimerRef.current) clearTimeout(helpTauntTimerRef.current)
      setShowHelpTaunt(false)
      setHelpTauntPos(null)
    }
  }, [closeAllSubmenus, isOpen])

  useLayoutEffect(() => {
    if (!showHelpTaunt || !isOpen) return
    updateHelpTauntPos()
    window.addEventListener('resize', updateHelpTauntPos)
    window.addEventListener('scroll', updateHelpTauntPos, true)
    return () => {
      window.removeEventListener('resize', updateHelpTauntPos)
      window.removeEventListener('scroll', updateHelpTauntPos, true)
    }
  }, [isOpen, showHelpTaunt, updateHelpTauntPos, phoneContentFillScale, openSubmenu])

  useEffect(() => {
    useShortcutUiStore.getState().registerProfileMenu({ closeSubmenus: closeAllSubmenus })
    return () => useShortcutUiStore.getState().registerProfileMenu(null)
  }, [closeAllSubmenus])

  useLayoutEffect(() => {
    if (!isPhone || !isOpen) return

    const panel = panelRef.current
    const content = contentRef.current
    if (!panel || !content) return

    const updateFillScale = () => {
      const targetHeight = panel.clientHeight
      const naturalHeight = content.scrollHeight
      if (targetHeight <= 0 || naturalHeight <= 0) return

      const nextScale = targetHeight / naturalHeight
      setPhoneContentFillScale((prev) =>
        Math.abs(prev - nextScale) < 0.004 ? prev : nextScale,
      )
    }

    updateFillScale()
    const observer = new ResizeObserver(updateFillScale)
    observer.observe(panel)
    observer.observe(content)
    return () => observer.disconnect()
  }, [
    isOpen,
    isPhone,
    profile.displayName,
    profile.handle,
    profile.studentCohort,
  ])

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
      !!target.closest('[data-phone-chrome-modal-scrim]') ||
      !!target.closest('[data-profile-save-bubble]') ||
      !!target.closest('[data-subscription-submenu]'),
    dismissInsidePanel: openSubmenu !== null,
  })

  const cycleStatus = () => {
    saveProfile({ ...profile, status: cycleProfileStatus(profile.status) })
  }

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
    if (destination === 'help') {
      if (helpTauntTimerRef.current) clearTimeout(helpTauntTimerRef.current)
      updateHelpTauntPos()
      setShowHelpTaunt(true)
      helpTauntTimerRef.current = setTimeout(() => setShowHelpTaunt(false), 2600)
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
            ? {
                ...phonePanelSheetStyle(
                  {
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    height: phoneTopMenuMaxHeight(PHONE_TOP_PANEL_SCALE),
                  },
                  'right',
                  PHONE_TOP_PANEL_SCALE,
                ),
                transformOrigin: phoneTopPanelTransformOrigin,
              }
            : { ...cardBase, top: PROFILE_PANEL_TOP + visualViewportOffsetTop }),
          ...chromeFrostedMenuStyle,
          fontFamily: font.family,
          color: font.colorPrimary,
          zIndex: 30,
          overflow: 'hidden',
        }}
        {...(isPhone ? phoneTopPanelSlideMotion : {
          initial: { opacity: 0, scale: 0.98, y: -2 },
          animate: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0, scale: 0.98, y: -2 },
          transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
        })}
      >
        <div
          ref={contentRef}
          style={
            isPhone
              ? {
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: `${100 / phoneContentFillScale}%`,
                  transform: `scale(${phoneContentFillScale})`,
                  transformOrigin: phoneTopPanelTransformOrigin,
                }
              : undefined
          }
        >
        <div data-profile-panel-header style={{ position: 'relative' }}>
          <ProfileBannerHeader
            bannerImageUrl={profileDraft?.bannerImageUrl ?? profile.bannerImageUrl}
            bannerFrame={profileDraft?.bannerFrame ?? profile.bannerFrame}
            displayName={profileDraft?.displayName ?? profile.displayName}
            avatarColor={profile.avatarColor}
            avatarImageUrl={profileDraft?.avatarImageUrl ?? profile.avatarImageUrl}
            avatarFrame={profileDraft?.avatarFrame ?? profile.avatarFrame}
            bannerHeight={isPhone ? 48 : undefined}
            avatarSize={isPhone ? 32 : undefined}
            contentGap={isPhone ? 4 : undefined}
            contentPaddingBottom={isPhone ? 6 : undefined}
            edgeToEdge
            status={profile.status}
          >
            <motion.div
              key={savedVersion}
              className={CHROME_PRESERVE_CASE_CLASS}
              variants={headerContainerVariants}
              initial={savedVersion > 0 ? 'hidden' : false}
              animate="show"
            >
              <motion.div variants={headerItemVariants}>
                <ProfileIdentityTags
                  displayName={profileDraft?.displayName ?? profile.displayName}
                  handle={profileDraft?.handle ?? profile.handle}
                  studentCohort={profile.studentCohort}
                  compact={isPhone}
                />
              </motion.div>
              {(profileDraft?.pinnedTrack ?? profile.pinnedTrack) && (
                <motion.div variants={headerItemVariants}>
                  <ProfilePinnedTrack
                    track={(profileDraft?.pinnedTrack ?? profile.pinnedTrack)!}
                  />
                </motion.div>
              )}
              {!isPhone && (profileDraft?.bio ?? profile.bio) && (
                <motion.div variants={headerItemVariants}>
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
                </motion.div>
              )}
              {!isPhone && (
                <motion.div variants={headerItemVariants}>
                  <ProfileSocialPills socials={profileDraft?.socials ?? profile.socials} centered />
                </motion.div>
              )}
            </motion.div>
          </ProfileBannerHeader>

          {/* Banner flash on save */}
          <AnimatePresence>
            {savedVersion > 0 && (
              <motion.div
                key={`flash-${savedVersion}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.22, 0] }}
                transition={{ duration: 0.7, times: [0, 0.18, 1], ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: isPhone ? 48 : 80,
                  background: 'rgba(255,255,255,0.7)',
                  pointerEvents: 'none',
                  zIndex: 5,
                }}
              />
            )}
          </AnimatePresence>
        </div>

        <div style={isPhone ? phoneMenuDividerStyle : menuDividerStyle} />

        <SubmenuSoundScope>
          <div style={{ padding: isPhone ? '2px 0' : '4px 0' }}>
            <MenuRow
              icon={Signal}
              label="Activity status"
              labelSuffix={profileStatusShortLabel(profile.status)}
              inset
              compact={isPhone}
              onClick={cycleStatus}
            />
            {NAV_ITEMS.map(({ icon, label, destination }) =>
              destination === 'help' ? (
                <div key={destination} ref={helpRowRef}>
                  <MenuRow
                    icon={icon}
                    label={label}
                    inset
                    compact={isPhone}
                    onClick={() => handleNav(destination)}
                  />
                </div>
              ) : (
                <MenuRow
                  key={destination}
                  icon={icon}
                  label={label}
                  inset
                  compact={isPhone}
                  onClick={() => handleNav(destination)}
                />
              ),
            )}
          </div>

          <div style={isPhone ? phoneMenuDividerStyle : menuDividerStyle} />

          <div style={{ padding: isPhone ? '2px 0 6px' : '4px 0 8px' }}>
            <MenuRow
              icon={LogOut}
              label="Sign out"
              inset
              compact={isPhone}
              destructive
              onClick={onSignOut}
            />
          </div>
        </SubmenuSoundScope>
        </div>
      </motion.div>

      {helpTauntPos &&
        createPortal(
          <AnimatePresence>
            {showHelpTaunt && isOpen && (
              <motion.span
                key="help-taunt"
                initial={{ opacity: 0, x: 6, y: '-50%', scale: 0.92 }}
                animate={{ opacity: 0.5, x: 0, y: '-50%', scale: 1 }}
                exit={{ opacity: 0, x: 6, y: '-50%', scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                style={{
                  position: 'fixed',
                  right: window.innerWidth - helpTauntPos.left + HELP_TAUNT_GAP,
                  top: helpTauntPos.y,
                  zIndex: 41,
                  fontFamily: font.family,
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--ui-text)',
                  letterSpacing: '-0.01em',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  maxWidth: 220,
                  whiteSpace: 'normal',
                  textAlign: 'right',
                  lineHeight: 1.3,
                  transformOrigin: 'right center',
                }}
              >
                {HELP_TAUNT_TEXT}
              </motion.span>
            )}
          </AnimatePresence>,
          document.body,
        )}

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
          />
        )}
      </AnimatePresence>
    </>
  )
}

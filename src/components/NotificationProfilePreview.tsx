import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  forwardRef,
  createContext,
  useContext,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import {
  CHROME_FROSTED_MENU_CLASS,
  CHROME_PRESERVE_CASE_CLASS,
  chromeFrostedMenuStyle,
  chromeLabel,
  font,
} from '../styles/tokens'
import type { NotificationActorProfile } from '../content/notificationActorProfiles'
import { playSound } from '../sound/playSound'
import { playSubmenuTap } from '../sound/submenuSound'
import type { ChromeMenuSoundOpts } from '../shortcuts/shortcutUiStore'
import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import { PHONE_CHROME_INSET } from '../styles/phoneChrome'
import { useMenuOutsideDismiss } from './useMenuOutsideDismiss'
import UserAvatar from './UserAvatar'
import { PROFILE_BANNER_HEIGHT } from './ProfileBannerHeader'

const CARD_WIDTH = 300
const PANEL_GAP = 12
const FLYOUT_TRANSITION = { duration: 0.18, ease: 'easeOut' as const }

type PreviewCoords = {
  top: number
  left: number
}

function ComingSoonOverlay({ onDismiss }: { onDismiss: () => void }) {
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onDismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.22 }}
        style={{
          margin: 0,
          color: '#fff',
          fontFamily: font.family,
          fontSize: 20,
          fontWeight: 500,
          letterSpacing: '-0.02em',
        }}
      >
        coming soon {'<3'}
      </motion.p>
    </motion.div>,
    document.body,
  )
}

function BioMention({
  text,
  onComingSoon,
}: {
  text: string
  onComingSoon: () => void
}) {
  const reduceMotion = useReducedMotion()
  const [hovered, setHovered] = useState(false)

  return (
    <motion.button
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation()
        onComingSoon()
      }}
      animate={{ scale: hovered && !reduceMotion ? 1.045 : 1 }}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { type: 'spring', stiffness: 420, damping: 32, mass: 0.5 }
      }
      style={{
        font: 'inherit',
        fontStyle: 'italic',
        fontWeight: 600,
        color: 'inherit',
        border: 'none',
        padding: 0,
        margin: 0,
        background: 'none',
        cursor: 'pointer',
        display: 'inline-block',
        verticalAlign: 'baseline',
        transformOrigin: 'center',
      }}
    >
      {text}
    </motion.button>
  )
}

function renderBio(bio: string, onComingSoon: () => void): React.ReactNode {
  const parts = bio.split(/(@\w+)/g)
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <BioMention key={i} text={part} onComingSoon={onComingSoon} />
    ) : (
      part
    ),
  )
}

const socialPillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '3px 8px',
  borderRadius: 6,
  border: '1px solid var(--glass-border)',
  background: 'rgba(20, 30, 50, 0.04)',
  color: font.colorMuted,
  fontSize: 11,
  fontWeight: 500,
  fontFamily: font.family,
  letterSpacing: '0.03em',
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
}

function CanvasPreviewMock({
  title,
  previewImageUrl,
}: {
  title: string
  previewImageUrl?: string
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [comingSoon, setComingSoon] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setComingSoon(true)
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          width: '100%',
          height: previewImageUrl ? 132 : 118,
          marginTop: 12,
          padding: 0,
          border: '1px solid var(--glass-border)',
          borderRadius: 12,
          overflow: 'hidden',
          cursor: 'pointer',
          background: previewImageUrl
            ? '#f4f4f2'
            : 'radial-gradient(circle at 20% 30%, rgba(148, 132, 184, 0.35), transparent 55%), radial-gradient(circle at 80% 70%, rgba(106, 155, 200, 0.28), transparent 50%), var(--card-bg)',
          textAlign: 'left',
        }}
      >
        {previewImageUrl ? (
          <img
            src={previewImageUrl}
            alt=""
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center top',
            }}
          />
        ) : (
          <>
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: 14,
                top: 16,
                width: 52,
                height: 38,
                borderRadius: 4,
                background: 'rgba(254, 243, 160, 0.92)',
                boxShadow: '0 2px 8px rgba(20, 30, 50, 0.08)',
                transform: 'rotate(-3deg)',
              }}
            />
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: 72,
                top: 28,
                width: 58,
                height: 42,
                borderRadius: 4,
                background: 'rgba(255, 212, 229, 0.9)',
                boxShadow: '0 2px 8px rgba(20, 30, 50, 0.08)',
                transform: 'rotate(2deg)',
              }}
            />
            <div
              aria-hidden
              style={{
                position: 'absolute',
                right: 14,
                top: 18,
                width: 74,
                height: 28,
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.72)',
                border: '1px solid rgba(255, 255, 255, 0.85)',
                boxShadow: '0 2px 8px rgba(20, 30, 50, 0.06)',
              }}
            />
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: 18,
                bottom: 14,
                width: 96,
                height: 6,
                borderRadius: 999,
                background: 'rgba(20, 30, 50, 0.08)',
              }}
            />
          </>
        )}
        {/* Gradient shadow — opacity-transitioned so it animates smoothly */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(20, 30, 50, 0.52), transparent 62%)',
            opacity: hovered ? 1 : 0.65,
            transition: 'opacity 220ms ease',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: '10px 12px',
          }}
        >
          <span
            className={CHROME_PRESERVE_CASE_CLASS}
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: '#fff',
              textShadow: '0 1px 4px rgba(0, 0, 0, 0.25)',
            }}
          >
            {title}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 2,
              fontSize: 11,
              color: 'rgba(255, 255, 255, 0.88)',
            }}
          >
            {chromeLabel('Visit canvas')}
            <ArrowUpRight size={12} strokeWidth={2} />
          </span>
        </div>
      </button>
      <AnimatePresence>
        {comingSoon && (
          <ComingSoonOverlay onDismiss={() => setComingSoon(false)} />
        )}
      </AnimatePresence>
    </>
  )
}

const ProfilePreviewCard = forwardRef<
  HTMLDivElement,
  {
    profile: NotificationActorProfile
    coords?: PreviewCoords
    layout: 'desktop-flyout' | 'phone-modal'
    onVisitCanvas: () => void
    onClose: () => void
  }
>(function ProfilePreviewCard(
  { profile, coords, layout, onVisitCanvas, onClose },
  ref,
) {
  const isPhoneModal = layout === 'phone-modal'
  const [comingSoon, setComingSoon] = useState(false)

  return (
    <motion.div
      ref={ref}
      data-notification-profile-preview=""
      {...(isPhoneModal
        ? {
            initial: { opacity: 0, scale: 0.94 },
            animate: { opacity: 1, scale: 1 },
            exit: { opacity: 0, scale: 0.94 },
            transition: FLYOUT_TRANSITION,
          }
        : {
            initial: { opacity: 0, scale: 0.96, x: -4 },
            animate: { opacity: 1, scale: 1, x: 0 },
            exit: { opacity: 0, scale: 0.96, x: -4 },
            transition: FLYOUT_TRANSITION,
          })}
      className={
        isPhoneModal
          ? `theme-surface ${CHROME_FROSTED_MENU_CLASS} notification-profile-preview-card--phone`
          : `theme-surface ${CHROME_FROSTED_MENU_CLASS}`
      }
      style={{
        position: isPhoneModal ? 'relative' : 'fixed',
        ...(isPhoneModal
          ? {
              width: `min(${CARD_WIDTH}px, calc(100vw - ${PHONE_CHROME_INSET * 2}px))`,
              maxHeight: 'min(72dvh, 520px)',
              ...chromeFrostedMenuStyle,
            }
          : {
              top: coords?.top,
              left: coords?.left,
              width: CARD_WIDTH,
              ...chromeFrostedMenuStyle,
            }),
        zIndex: isPhoneModal ? 56 : 46,
        fontFamily: font.family,
        color: font.colorPrimary,
        overflow: 'hidden',
        pointerEvents: 'auto',
        display: isPhoneModal ? 'flex' : undefined,
        flexDirection: isPhoneModal ? 'column' : undefined,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          flex: isPhoneModal ? 1 : undefined,
          minHeight: isPhoneModal ? 0 : undefined,
          overflowY: isPhoneModal ? 'auto' : undefined,
        }}
        className={isPhoneModal ? 'chrome-scroll-hidden' : undefined}
      >
        <div style={{ position: 'relative' }}>
          {isPhoneModal && (
            <button
              type="button"
              aria-label="Back"
              onClick={() => {
                playSubmenuTap()
                onClose()
              }}
              style={{
                position: 'absolute',
                top: 6,
                left: 6,
                zIndex: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                padding: 0,
                border: 'none',
                borderRadius: 8,
                background: 'transparent',
                cursor: 'pointer',
                opacity: 0.58,
              }}
            >
              <ArrowLeft
                size={16}
                strokeWidth={2}
                color={font.colorMuted}
                style={{ filter: 'drop-shadow(0 1px 2px rgba(20, 30, 50, 0.16))' }}
              />
            </button>
          )}
          <div
            aria-hidden
            style={{
              height: PROFILE_BANNER_HEIGHT,
              position: 'relative',
              overflow: 'hidden',
              background: profile.bannerGradient ?? 'var(--card-bg)',
            }}
          >
            {profile.bannerImageUrl && (
              <img
                src={profile.bannerImageUrl}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center 18%',
                }}
              />
            )}
          </div>
          <div
            style={{
              position: 'absolute',
              left: 14,
              bottom: 0,
              transform: 'translateY(50%)',
              zIndex: 2,
              borderRadius: '50%',
              boxShadow: isPhoneModal
                ? '0 0 0 3px var(--chrome-solid-bg)'
                : '0 0 0 3px var(--card-bg)',
            }}
          >
            <UserAvatar
              displayName={profile.avatarInitial}
              avatarColor={profile.avatarColor}
              avatarImageUrl={profile.avatarImageUrl}
              size={44}
              fontSize={16}
            />
          </div>
        </div>
        <div
          style={{
            padding: '28px 14px 14px',
          }}
        >
        <div className={CHROME_PRESERVE_CASE_CLASS}>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 600,
              color: font.colorPrimary,
            }}
          >
            {profile.displayName}
          </p>
          <p
            style={{
              margin: '2px 0 0',
              fontSize: 12,
              color: font.colorMuted,
            }}
          >
            {profile.handle}
            {profile.cohort ? ` · ${profile.cohort}` : ''}
          </p>
        </div>
        <p
          className={CHROME_PRESERVE_CASE_CLASS}
          style={{
            margin: '10px 0 0',
            fontSize: 13,
            lineHeight: 1.45,
            color: font.colorMuted,
          }}
        >
          {renderBio(profile.bio, () => setComingSoon(true))}
        </p>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            marginTop: 10,
          }}
        >
          {profile.socials.map(({ label, value }) => (
            <span key={label} style={socialPillStyle}>
              {chromeLabel(`${label} · ${value}`)}
            </span>
          ))}
        </div>
        <CanvasPreviewMock
          title={profile.canvasTitle}
          previewImageUrl={profile.canvasPreviewImageUrl}
          onClick={onVisitCanvas}
        />
        </div>
      </div>
      <AnimatePresence>
        {comingSoon && (
          <ComingSoonOverlay onDismiss={() => setComingSoon(false)} />
        )}
      </AnimatePresence>
    </motion.div>
  )
})

type ActorProfileContextValue = {
  openHandle: string | null
  profilePreviewOpen: boolean
  setAnchor: (el: HTMLElement | null) => void
  handleTriggerClick: (
    profile: NotificationActorProfile,
    e: ReactMouseEvent<HTMLButtonElement>,
  ) => void
}

const ActorProfileContext = createContext<ActorProfileContextValue | null>(null)

export function useNotificationActorProfileContext() {
  return useContext(ActorProfileContext)
}

function useProfilePreviewCoords(
  activeAnchorRef: React.RefObject<HTMLElement | null>,
  cardRef: React.RefObject<HTMLDivElement | null>,
) {
  const updateCoords = useCallback(() => {
    const anchor = activeAnchorRef.current
    if (!anchor) return { top: 0, left: 0 }
    const anchorRect = anchor.getBoundingClientRect()
    const cardHeight = cardRef.current?.offsetHeight ?? 360
    const margin = 16

    const panel = document.querySelector('[data-notifications-panel]')
    let left: number
    let top: number

    if (panel instanceof HTMLElement) {
      const panelRect = panel.getBoundingClientRect()
      left = panelRect.left - CARD_WIDTH - PANEL_GAP
      top = panelRect.top + (panelRect.height - cardHeight) / 2
    } else {
      left = anchorRect.left - CARD_WIDTH - PANEL_GAP
      top = anchorRect.top - 28
    }

    left = Math.max(margin, left)
    top = Math.max(margin, Math.min(top, window.innerHeight - cardHeight - margin))

    return { top, left }
  }, [activeAnchorRef, cardRef])

  return updateCoords
}

function ProfilePreviewFlyout({
  profile,
  coords,
  cardRef,
  onVisitCanvas,
  onClose,
}: {
  profile: NotificationActorProfile
  coords: PreviewCoords
  cardRef: React.RefObject<HTMLDivElement | null>
  onVisitCanvas: () => void
  onClose: () => void
}) {
  const isPhone = useIsPhoneLayout()
  const [mounted, setMounted] = useState(false)

  useLayoutEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  if (isPhone) {
    return createPortal(
      <motion.div
        data-notification-profile-preview-scrim=""
        className="ui-chrome-scrim notification-profile-preview-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={FLYOUT_TRANSITION}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 55,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: PHONE_CHROME_INSET,
        }}
        onClick={() => {
          playSubmenuTap()
          onClose()
        }}
      >
        <ProfilePreviewCard
          ref={cardRef}
          profile={profile}
          layout="phone-modal"
          onVisitCanvas={onVisitCanvas}
          onClose={onClose}
        />
      </motion.div>,
      document.body,
    )
  }

  return createPortal(
    <ProfilePreviewCard
      ref={cardRef}
      profile={profile}
      layout="desktop-flyout"
      coords={coords}
      onVisitCanvas={onVisitCanvas}
      onClose={onClose}
    />,
    document.body,
  )
}

/** Panel-level flyout host — dismiss and exit animations stay in sync with NotificationsPanel. */
export function NotificationProfilePreviewScope({
  isActive,
  panelRef,
  onClosePanel,
  onVisitCanvas,
  children,
}: {
  isActive: boolean
  panelRef: React.RefObject<HTMLElement | null>
  onClosePanel: () => void
  onVisitCanvas?: (handle: string) => void
  children: ReactNode
}) {
  const activeAnchorRef = useRef<HTMLElement | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const openRef = useRef(false)
  const [openProfile, setOpenProfile] = useState<NotificationActorProfile | null>(null)
  const [coords, setCoords] = useState<PreviewCoords>({ top: 0, left: 0 })
  const updateCoords = useProfilePreviewCoords(activeAnchorRef, cardRef)

  const closeProfile = useCallback((opts?: ChromeMenuSoundOpts) => {
    if (!openRef.current) return
    if (!opts?.silent) playSound('profileClose', { layer: true })
    setOpenProfile(null)
  }, [])

  useEffect(() => {
    openRef.current = openProfile !== null
  }, [openProfile])

  useEffect(() => {
    if (!isActive) closeProfile({ silent: true })
  }, [closeProfile, isActive])

  useEffect(() => {
    useShortcutUiStore.getState().registerNotificationProfilePreview({
      close: closeProfile,
      isOpen: () => openRef.current,
    })
    return () => useShortcutUiStore.getState().registerNotificationProfilePreview(null)
  }, [closeProfile])

  const dismissFromOutside = useCallback(
    (target: Element) => {
      if (target.closest('[data-notification-profile-trigger]')) return

      if (panelRef.current?.contains(target)) {
        closeProfile()
        return
      }

      closeProfile()
      onClosePanel()
    },
    [closeProfile, onClosePanel, panelRef],
  )

  useMenuOutsideDismiss({
    active: isActive,
    panelRef,
    onDismiss: dismissFromOutside,
    isInside: (target) =>
      !!target.closest('[data-notification-profile-preview]') ||
      !!target.closest('[data-notification-profile-preview-scrim]'),
    dismissInsidePanel: openProfile !== null,
  })

  const setAnchor = useCallback((el: HTMLElement | null) => {
    activeAnchorRef.current = el
  }, [])

  const handleTriggerClick = useCallback(
    (profile: NotificationActorProfile, e: ReactMouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      setAnchor(e.currentTarget)
      if (openProfile?.handle === profile.handle) {
        closeProfile()
        return
      }
      playSound('profileOpen', { layer: true })
      setCoords(updateCoords())
      setOpenProfile(profile)
    },
    [closeProfile, openProfile, setAnchor, updateCoords],
  )

  useLayoutEffect(() => {
    if (!openProfile) return
    const id = requestAnimationFrame(() => setCoords(updateCoords()))
    return () => cancelAnimationFrame(id)
  }, [openProfile, updateCoords])

  useLayoutEffect(() => {
    if (!openProfile) return
    const syncCoords = () => setCoords(updateCoords())
    syncCoords()
    window.addEventListener('resize', syncCoords)
    window.addEventListener('scroll', syncCoords, true)
    return () => {
      window.removeEventListener('resize', syncCoords)
      window.removeEventListener('scroll', syncCoords, true)
    }
  }, [openProfile, updateCoords])

  useEffect(() => {
    if (!openProfile) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeProfile()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [closeProfile, openProfile])

  return (
    <>
      <ActorProfileContext.Provider
        value={{
          openHandle: openProfile?.handle ?? null,
          profilePreviewOpen: openProfile !== null,
          setAnchor,
          handleTriggerClick,
        }}
      >
        {children}
      </ActorProfileContext.Provider>
      <AnimatePresence mode="sync">
        {openProfile && (
          <ProfilePreviewFlyout
            key={openProfile.handle}
            profile={openProfile}
            coords={coords}
            cardRef={cardRef}
            onClose={closeProfile}
            onVisitCanvas={() => {
              onVisitCanvas?.(openProfile.handle)
              closeProfile()
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}

export function NotificationActorProfileProvider({
  profile,
  onVisitCanvas,
  children,
}: {
  profile: NotificationActorProfile
  onVisitCanvas?: (handle: string) => void
  children: ReactNode
}) {
  const activeAnchorRef = useRef<HTMLElement | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const openRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<PreviewCoords>({ top: 0, left: 0 })
  const updateCoords = useProfilePreviewCoords(activeAnchorRef, cardRef)

  const closeProfile = useCallback((opts?: ChromeMenuSoundOpts) => {
    if (!openRef.current) return
    if (!opts?.silent) playSound('profileClose', { layer: true })
    setOpen(false)
  }, [])

  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    useShortcutUiStore.getState().registerNotificationProfilePreview({
      close: closeProfile,
      isOpen: () => openRef.current,
    })
    return () => useShortcutUiStore.getState().registerNotificationProfilePreview(null)
  }, [closeProfile])

  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: PointerEvent) {
      const target = e.target
      if (!(target instanceof Element)) return
      if (cardRef.current?.contains(target)) return
      if (target.closest('[data-notification-profile-trigger]')) return
      closeProfile()
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [open, closeProfile])

  const setAnchor = useCallback((el: HTMLElement | null) => {
    activeAnchorRef.current = el
  }, [])

  const handleTriggerClick = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      setAnchor(e.currentTarget)
      if (open) {
        closeProfile()
        return
      }
      playSound('profileOpen', { layer: true })
      setCoords(updateCoords())
      setOpen(true)
    },
    [open, closeProfile, setAnchor, updateCoords],
  )

  useLayoutEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => setCoords(updateCoords()))
    return () => cancelAnimationFrame(id)
  }, [open, updateCoords])

  useLayoutEffect(() => {
    if (!open) return
    const syncCoords = () => setCoords(updateCoords())
    syncCoords()
    window.addEventListener('resize', syncCoords)
    window.addEventListener('scroll', syncCoords, true)
    return () => {
      window.removeEventListener('resize', syncCoords)
      window.removeEventListener('scroll', syncCoords, true)
    }
  }, [open, updateCoords])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeProfile()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, closeProfile])

  return (
    <ActorProfileContext.Provider
      value={{
        openHandle: open ? profile.handle : null,
        profilePreviewOpen: open,
        setAnchor,
        handleTriggerClick: (_triggerProfile, e) => handleTriggerClick(e),
      }}
    >
      {children}
      <AnimatePresence mode="sync">
        {open && (
          <ProfilePreviewFlyout
            key={profile.handle}
            profile={profile}
            coords={coords}
            cardRef={cardRef}
            onClose={closeProfile}
            onVisitCanvas={() => {
              onVisitCanvas?.(profile.handle)
              closeProfile()
            }}
          />
        )}
      </AnimatePresence>
    </ActorProfileContext.Provider>
  )
}

function useActorProfileTriggerHandlers(
  profile: NotificationActorProfile,
  triggerRef: React.RefObject<HTMLButtonElement | null>,
) {
  const ctx = useNotificationActorProfileContext()
  const [hovered, setHoveredLocal] = useState(false)

  if (!ctx) {
    return {
      hovered: false,
      open: false,
      triggerProps: {},
    }
  }

  const { openHandle, setAnchor, handleTriggerClick } = ctx
  const open = openHandle === profile.handle

  return {
    hovered: hovered,
    open,
    triggerProps: {
      onClick: (e: ReactMouseEvent<HTMLButtonElement>) => handleTriggerClick(profile, e),
      onMouseEnter: () => {
        setHoveredLocal(true)
        setAnchor(triggerRef.current)
      },
      onMouseLeave: () => {
        setHoveredLocal(false)
      },
      onFocus: () => {
        setHoveredLocal(true)
        setAnchor(triggerRef.current)
      },
      onBlur: () => {
        setHoveredLocal(false)
      },
    },
  }
}

export function NotificationActorProfileTextTrigger({
  profile,
  children,
}: {
  profile: NotificationActorProfile
  children: ReactNode
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { hovered, open, triggerProps } = useActorProfileTriggerHandlers(profile, triggerRef)
  const reduceMotion = useReducedMotion()

  return (
    <motion.button
      ref={triggerRef}
      type="button"
      data-notification-profile-trigger=""
      aria-expanded={open}
      aria-haspopup="dialog"
      {...triggerProps}
      animate={{ scale: hovered && !reduceMotion ? 1.045 : 1 }}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { type: 'spring', stiffness: 420, damping: 32, mass: 0.5 }
      }
      style={{
        font: 'inherit',
        fontStyle: 'italic',
        fontWeight: 600,
        color: 'inherit',
        border: 'none',
        padding: 0,
        margin: 0,
        background: 'none',
        cursor: 'pointer',
        display: 'inline-block',
        verticalAlign: 'baseline',
        transformOrigin: 'center',
      }}
    >
      {children}
    </motion.button>
  )
}

export function NotificationActorProfileAvatarTrigger({
  profile,
  displayName,
  avatarColor,
  avatarImageUrl,
  size = 32,
  fontSize = 12,
}: {
  profile: NotificationActorProfile
  displayName: string
  avatarColor: string
  avatarImageUrl?: string
  size?: number
  fontSize?: number
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { open, triggerProps } = useActorProfileTriggerHandlers(profile, triggerRef)
  const reduceMotion = useReducedMotion()

  return (
    <motion.button
      ref={triggerRef}
      type="button"
      aria-label={`View ${displayName} profile`}
      data-notification-profile-trigger=""
      aria-expanded={open}
      aria-haspopup="dialog"
      {...triggerProps}
      whileTap={reduceMotion ? undefined : { scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 480, damping: 28, mass: 0.45 }}
      style={{
        flexShrink: 0,
        display: 'block',
        padding: 0,
        margin: 0,
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        borderRadius: '50%',
      }}
    >
      <UserAvatar
        displayName={displayName}
        avatarColor={avatarColor}
        avatarImageUrl={avatarImageUrl}
        size={size}
        fontSize={fontSize}
      />
    </motion.button>
  )
}

export function NotificationActorLink({
  profile,
  onVisitCanvas,
  children,
}: {
  profile?: NotificationActorProfile
  onVisitCanvas?: (handle: string) => void
  children: React.ReactNode
}) {
  if (!profile) {
    return (
      <span style={{ fontStyle: 'italic', fontWeight: 600 }}>{children}</span>
    )
  }

  return (
    <NotificationActorProfileProvider profile={profile} onVisitCanvas={onVisitCanvas}>
      <NotificationActorProfileTextTrigger profile={profile}>
        {children}
      </NotificationActorProfileTextTrigger>
    </NotificationActorProfileProvider>
  )
}

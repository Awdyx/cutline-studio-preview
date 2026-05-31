import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type RefObject } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Bell, Newspaper } from 'lucide-react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import { CHROME_GLASS_CLASS, CHROME_PRESERVE_CASE_CLASS, CHROME_TAP_SQUEEZE_TARGET_CLASS, CHROME_SURFACE_BG_TRANSITION, chromeGlassSurfaceBg, glass, font } from '../styles/tokens'
import { APP_DESTINATION_LABELS, useAppDestinationStore } from '../navigation/appDestinationStore'
import { PHONE_HEADER_ROW_GAP } from '../styles/phoneChrome'
import CanvasSearchBar from './CanvasSearchBar'
import ChromeTapSqueezeWrap from './ChromeTapSqueezeWrap'
import UserAvatar from './UserAvatar'
import ProfileStatusDot from './ProfileStatusDot'
import UiPinHost from '../uiCustomization/UiPinHost'
import { useUiCustomizationStore } from '../uiCustomization/uiCustomizationStore'
import { desktopChromeEdgeLeft, desktopChromeEdgeRight, desktopChromeEdgeTop } from '../platform/chromeLayout'
import type { TopBarUser } from '../profile/types'

const islandBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  border: glass.border,
  boxShadow: glass.shadow,
  borderRadius: glass.radius,
  fontFamily: font.family,
  color: font.colorPrimary,
  userSelect: 'none',
}

const brandPillDestinationLabelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 400,
  color: font.colorMuted,
  letterSpacing: '-0.01em',
}

function BrandPillDestinationLabel({ label }: { label: string }) {
  return (
    <span
      style={{
        ...brandPillDestinationLabelStyle,
        display: 'inline-flex',
        opacity: 0.75,
        overflow: 'hidden',
        minWidth: '3.25em',
        justifyContent: 'flex-start',
      }}
    >
      <span style={brandPillDestinationLabelStyle}>{label}</span>
    </span>
  )
}

// ─── Brand Pill ───────────────────────────────────────────────────────────────

interface BrandPillProps {
  isOpen?: boolean
  onClick?: () => void
  /** Stretch pill to fill its column (desktop top bar balance). */
  fullWidth?: boolean
}

export function BrandPill({ isOpen = false, onClick, fullWidth = false }: BrandPillProps) {
  const destination = useAppDestinationStore((s) => s.destination)
  const [hovered, setHovered] = useState(false)

  const editingUi = useUiCustomizationStore((s) => s.editing)
  const destinationLabel = APP_DESTINATION_LABELS[destination]
  const showHoverBackground = hovered && !editingUi

  return (
    <button
      type="button"
      data-panel-trigger="cutline"
      data-ui-anchor="brand-pill"
      aria-label="Cutline menu"
      aria-expanded={isOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      className={`${CHROME_TAP_SQUEEZE_TARGET_CLASS} theme-surface ${CHROME_GLASS_CLASS}`}
      style={{
        ...islandBase,
        position: 'relative',
        gap: 8,
        padding: '8px 16px',
        width: fullWidth ? '100%' : undefined,
        justifyContent: fullWidth ? 'center' : undefined,
        cursor: 'pointer',
        transition: editingUi ? undefined : CHROME_SURFACE_BG_TRANSITION,
        background: chromeGlassSurfaceBg({
          active: isOpen,
          hoverLift: showHoverBackground,
        }),
        border: glass.border,
      }}
    >
      <span
        style={{
          width: 7, height: 7, borderRadius: '50%',
          backgroundColor: '#3ecf6e',
          boxShadow: '0 0 6px rgba(62, 207, 110, 0.7)',
          flexShrink: 0,
        }}
      />
      <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>Cutline</span>
      <BrandPillDestinationLabel label={destinationLabel} />
      <UiPinHost anchorId="brand-pill" />
    </button>
  )
}

// ─── Chrome island button ─────────────────────────────────────────────────────

interface ChromeIslandButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  islandStyle?: React.CSSProperties
}

function ChromeIslandButton({
  active = false,
  islandStyle,
  className,
  style,
  children,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: ChromeIslandButtonProps) {
  const [hovered, setHovered] = useState(false)
  const editingUi = useUiCustomizationStore((s) => s.editing)
  const hoverLift = hovered && !editingUi

  return (
    <button
      {...rest}
      onMouseEnter={(e) => {
        setHovered(true)
        onMouseEnter?.(e)
      }}
      onMouseLeave={(e) => {
        setHovered(false)
        onMouseLeave?.(e)
      }}
      className={`theme-surface ${CHROME_GLASS_CLASS}${className ? ` ${className}` : ''}`}
      style={{
        ...islandBase,
        position: 'relative',
        cursor: 'pointer',
        transition: editingUi ? undefined : CHROME_SURFACE_BG_TRANSITION,
        background: chromeGlassSurfaceBg({ active, hoverLift }),
        ...islandStyle,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

// ─── User Cluster ─────────────────────────────────────────────────────────────

function AttentionIcon({
  active,
  origin,
  children,
}: {
  active: boolean
  origin: string
  children: ReactNode
}) {
  return (
    <span
      className={active ? 'chrome-icon-attention' : undefined}
      style={{ display: 'inline-flex', transformOrigin: origin }}
    >
      {children}
    </span>
  )
}

interface UserClusterProps {
  user: TopBarUser
  unreadCount: number
  newsCount: number
  newsOpen?: boolean
  notificationsOpen?: boolean
  profileOpen?: boolean
  onNewsClick: () => void
  onNotificationClick: () => void
  onProfileClick: () => void
  compact?: boolean
}

const profilePillEase = [0.22, 1, 0.36, 1] as const

export function UserCluster({
  user,
  unreadCount,
  newsCount,
  newsOpen = false,
  notificationsOpen = false,
  profileOpen = false,
  onNewsClick,
  onNotificationClick,
  onProfileClick,
  compact = false,
}: UserClusterProps) {
  const reduceMotion = useReducedMotion()
  const statusSlotTransition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.72 }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 6 : 8 }}>
      <ChromeTapSqueezeWrap compact>
        <ChromeIslandButton
          type="button"
          onClick={onNewsClick}
          active={newsOpen}
          aria-label={newsCount > 0 ? `News, ${newsCount} new` : 'News'}
          data-panel-trigger="news"
          data-ui-anchor="news"
          islandStyle={{ padding: 10 }}
        >
          <AttentionIcon active={newsCount > 0} origin="center center">
            <Newspaper size={16} color="var(--ui-text)" strokeWidth={1.8} />
          </AttentionIcon>
          <UiPinHost anchorId="news" />
        </ChromeIslandButton>
      </ChromeTapSqueezeWrap>

      <ChromeTapSqueezeWrap compact>
        <ChromeIslandButton
          type="button"
          onClick={onNotificationClick}
          active={notificationsOpen}
          aria-label={
            unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
          }
          data-panel-trigger="notifications"
          data-ui-anchor="notifications"
          islandStyle={{ padding: 10 }}
        >
          <AttentionIcon active={unreadCount > 0} origin="top center">
            <Bell size={16} color="var(--ui-text)" strokeWidth={1.8} />
          </AttentionIcon>
          <UiPinHost anchorId="notifications" />
        </ChromeIslandButton>
      </ChromeTapSqueezeWrap>

      <ChromeTapSqueezeWrap compact={compact}>
        <ChromeIslandButton
          type="button"
          onClick={onProfileClick}
          active={profileOpen}
          aria-label={`Profile: ${user.name}`}
          data-panel-trigger="profile"
          data-ui-anchor="profile"
          islandStyle={{
            gap: 0,
            padding: compact
              ? 6
              : `6px ${profileOpen ? 8 : 12}px 6px 8px`,
            transition: reduceMotion
              ? undefined
              : `${CHROME_SURFACE_BG_TRANSITION}, padding 0.38s cubic-bezier(${profilePillEase.join(', ')})`,
          }}
        >
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: compact ? 0 : 8,
              minWidth: 0,
            }}
          >
            <UserAvatar
              displayName={user.name}
              avatarColor={user.avatarColor}
              avatarImageUrl={user.avatarImageUrl}
              avatarFrame={user.avatarFrame}
              size={compact ? 28 : 24}
              fontSize={11}
            />
            {!compact && (
              <span
                className={CHROME_PRESERVE_CASE_CLASS}
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: font.colorPrimary,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {user.name}
              </span>
            )}
          </span>
          <motion.span
            aria-hidden={profileOpen}
            animate={{
              width: profileOpen ? 0 : 8,
              opacity: profileOpen ? 0 : 1,
              marginLeft: profileOpen ? 0 : compact ? 6 : 8,
            }}
            transition={statusSlotTransition}
            style={{
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <ProfileStatusDot status={user.status} placement="inline" />
          </motion.span>
          <UiPinHost anchorId="profile" />
        </ChromeIslandButton>
      </ChromeTapSqueezeWrap>
    </div>
  )
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

interface TopBarProps {
  user: UserClusterProps['user']
  unreadCount: number
  cutlineMenuOpen?: boolean
  newsOpen?: boolean
  notificationsOpen?: boolean
  profileOpen?: boolean
  /** Phone: collapse search row while a top chrome menu is open. */
  phoneMenuOpen?: boolean
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  onCutlineClick: () => void
  onNewsClick: () => void
  onNotificationClick: () => void
  onProfileClick: () => void
  newsCount: number
}

export default function TopBar({
  user,
  unreadCount,
  cutlineMenuOpen = false,
  newsOpen = false,
  notificationsOpen = false,
  profileOpen = false,
  phoneMenuOpen = false,
  transformRef,
  onCutlineClick,
  onNewsClick,
  onNotificationClick,
  onProfileClick,
  newsCount,
}: TopBarProps) {
  const isPhone = useIsPhoneLayout()
  const userClusterRef = useRef<HTMLDivElement>(null)
  const [sideColumnWidth, setSideColumnWidth] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (isPhone) {
      setSideColumnWidth(undefined)
      return
    }

    const el = userClusterRef.current
    if (!el) return

    const update = () => {
      const next = Math.ceil(el.getBoundingClientRect().width)
      setSideColumnWidth((prev) => (prev === next ? prev : next))
    }
    update()

    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [isPhone, user.name, unreadCount, newsCount, profileOpen])

  if (isPhone) {
    return (
      <div
        className="cutline-top-bar cutline-top-bar--phone"
        style={{
          position: 'fixed',
          top: 'max(12px, env(safe-area-inset-top, 0px))',
          left: 12,
          right: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: PHONE_HEADER_ROW_GAP,
          zIndex: 20,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            pointerEvents: 'none',
          }}
        >
          <div style={{ pointerEvents: 'auto', flexShrink: 0 }}>
            <BrandPill isOpen={cutlineMenuOpen} onClick={onCutlineClick} />
          </div>
          <div style={{ pointerEvents: 'auto', flexShrink: 0, minWidth: 0 }}>
            <UserCluster
              user={user}
              unreadCount={unreadCount}
              newsCount={newsCount}
              newsOpen={newsOpen}
              notificationsOpen={notificationsOpen}
              profileOpen={profileOpen}
              onNewsClick={onNewsClick}
              onNotificationClick={onNotificationClick}
              onProfileClick={onProfileClick}
              compact
            />
          </div>
        </div>
        <div
          className={
            phoneMenuOpen
              ? 'cutline-top-bar-search cutline-top-bar-search--hidden'
              : 'cutline-top-bar-search'
          }
        >
          <CanvasSearchBar
            transformRef={transformRef}
            compact
            hidden={phoneMenuOpen}
          />
        </div>
      </div>
    )
  }

  const leftColumnStyle: React.CSSProperties | undefined = sideColumnWidth
    ? { width: sideColumnWidth, minWidth: sideColumnWidth, maxWidth: sideColumnWidth }
    : undefined
  const rightColumnStyle: React.CSSProperties | undefined = sideColumnWidth
    ? { minWidth: sideColumnWidth }
    : undefined

  return (
    <div
      className="cutline-top-bar"
      style={{
        position: 'fixed',
        top: desktopChromeEdgeTop,
        left: desktopChromeEdgeLeft,
        right: desktopChromeEdgeRight,
        display: 'grid',
        gridTemplateColumns:
          sideColumnWidth != null
            ? `${sideColumnWidth}px 1fr ${sideColumnWidth}px`
            : 'auto 1fr auto',
        alignItems: 'center',
        gap: 12,
        zIndex: 20,
        pointerEvents: 'none',
      }}
    >
      <div
        className="cutline-top-bar__leading"
        style={{ pointerEvents: 'auto', ...leftColumnStyle }}
      >
        <BrandPill
          isOpen={cutlineMenuOpen}
          onClick={onCutlineClick}
          fullWidth={sideColumnWidth != null}
        />
      </div>
      <div
        className="cutline-top-bar__center"
        style={{
          pointerEvents: 'none',
          display: 'flex',
          justifyContent: 'center',
          minWidth: 0,
        }}
      >
        <CanvasSearchBar transformRef={transformRef} />
      </div>
      <div
        ref={userClusterRef}
        className="cutline-top-bar__trailing"
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          justifyContent: 'flex-end',
          ...rightColumnStyle,
        }}
      >
        <UserCluster
          user={user}
          unreadCount={unreadCount}
          newsCount={newsCount}
          newsOpen={newsOpen}
          notificationsOpen={notificationsOpen}
          profileOpen={profileOpen}
          onNewsClick={onNewsClick}
          onNotificationClick={onNotificationClick}
          onProfileClick={onProfileClick}
        />
      </div>
    </div>
  )
}

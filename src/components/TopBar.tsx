import { useState, type ReactNode, type RefObject } from 'react'
import { Bell, Newspaper } from 'lucide-react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import { CHROME_GLASS_CLASS, CHROME_PRESERVE_CASE_CLASS, glass, font } from '../styles/tokens'
import CanvasSearchBar from './CanvasSearchBar'
import UserAvatar from './UserAvatar'
import type { ProfileMediaFrame } from '../profile/types'

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

// ─── Brand Pill ───────────────────────────────────────────────────────────────

interface BrandPillProps {
  isOpen?: boolean
  onClick?: () => void
}

export function BrandPill({ isOpen = false, onClick }: BrandPillProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      onClick={onClick}
      data-panel-trigger="cutline"
      aria-label="Cutline menu"
      aria-expanded={isOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`theme-surface ${CHROME_GLASS_CLASS}`}
      style={{
        ...islandBase,
        gap: 8,
        padding: '8px 16px',
        cursor: 'pointer',
        background: isOpen
          ? 'var(--card-bg)'
          : hovered
            ? 'var(--card-bg)'
            : glass.bg,
        border: glass.border,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          backgroundColor: '#3ecf6e',
          boxShadow: '0 0 6px rgba(62, 207, 110, 0.7)',
          flexShrink: 0,
        }}
      />
      <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>
        Cutline
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: font.colorMuted,
          letterSpacing: '0.01em',
        }}
      >
        2.0
      </span>
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
  user: {
    name: string
    initial: string
    avatarColor: string
    avatarImageUrl?: string | null
    avatarFrame?: ProfileMediaFrame | null
  }
  unreadCount: number
  newsCount: number
  onNewsClick: () => void
  onNotificationClick: () => void
  onProfileClick: () => void
  compact?: boolean
}

export function UserCluster({
  user,
  unreadCount,
  newsCount,
  onNewsClick,
  onNotificationClick,
  onProfileClick,
  compact = false,
}: UserClusterProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 6 : 8 }}>
      <button
        type="button"
        onClick={onNewsClick}
        aria-label={newsCount > 0 ? `News, ${newsCount} new` : 'News'}
        data-panel-trigger="news"
        className={`theme-surface ${CHROME_GLASS_CLASS}`}
        style={{
          ...islandBase,
          background: glass.bg,
          padding: 10,
          cursor: 'pointer',
        }}
      >
        <AttentionIcon active={newsCount > 0} origin="center center">
          <Newspaper size={16} color="var(--ui-text)" strokeWidth={1.8} />
        </AttentionIcon>
      </button>

      <button
        type="button"
        onClick={onNotificationClick}
        aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
        }
        data-panel-trigger="notifications"
        className={`theme-surface ${CHROME_GLASS_CLASS}`}
        style={{
          ...islandBase,
          background: glass.bg,
          padding: 10,
          cursor: 'pointer',
        }}
      >
        <AttentionIcon active={unreadCount > 0} origin="top center">
          <Bell size={16} color="var(--ui-text)" strokeWidth={1.8} />
        </AttentionIcon>
      </button>

      <button
        onClick={onProfileClick}
        aria-label={`Profile: ${user.name}`}
        data-panel-trigger="profile"
        className={`theme-surface ${CHROME_GLASS_CLASS}`}
        style={{
          ...islandBase,
          background: glass.bg,
          gap: compact ? 0 : 8,
          padding: compact ? 6 : '6px 12px 6px 8px',
          cursor: 'pointer',
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
            style={{ fontSize: 14, fontWeight: 500, color: font.colorPrimary }}
          >
            {user.name}
          </span>
        )}
      </button>
    </div>
  )
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

interface TopBarProps {
  user: UserClusterProps['user']
  unreadCount: number
  cutlineMenuOpen?: boolean
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
  phoneMenuOpen = false,
  transformRef,
  onCutlineClick,
  onNewsClick,
  onNotificationClick,
  onProfileClick,
  newsCount,
}: TopBarProps) {
  const isPhone = useIsPhoneLayout()

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
          gap: 8,
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

  return (
    <div
      className="cutline-top-bar"
      style={{
        position: 'fixed',
        top: 16,
        left: 16,
        right: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        zIndex: 20,
        pointerEvents: 'none',
      }}
    >
      <div style={{ pointerEvents: 'auto', flexShrink: 0 }}>
        <BrandPill isOpen={cutlineMenuOpen} onClick={onCutlineClick} />
      </div>
      <div
        style={{
          pointerEvents: 'none',
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <CanvasSearchBar transformRef={transformRef} />
      </div>
      <div style={{ pointerEvents: 'auto', flexShrink: 0 }}>
        <UserCluster
          user={user}
          unreadCount={unreadCount}
          newsCount={newsCount}
          onNewsClick={onNewsClick}
          onNotificationClick={onNotificationClick}
          onProfileClick={onProfileClick}
        />
      </div>
    </div>
  )
}

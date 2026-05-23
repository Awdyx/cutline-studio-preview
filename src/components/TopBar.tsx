import { useState, type RefObject } from 'react'
import { Bell } from 'lucide-react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { CHROME_GLASS_CLASS, CHROME_PRESERVE_CASE_CLASS, glass, font } from '../styles/tokens'
import CanvasSearchBar from './CanvasSearchBar'
import UserAvatar from './UserAvatar'

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

interface UserClusterProps {
  user: {
    name: string
    initial: string
    avatarColor: string
    avatarImageUrl?: string | null
  }
  unreadCount: number
  onNotificationClick: () => void
  onProfileClick: () => void
}

export function UserCluster({
  user,
  unreadCount,
  onNotificationClick,
  onProfileClick,
}: UserClusterProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        onClick={onNotificationClick}
        aria-label="Notifications"
        data-panel-trigger="notifications"
        className={`theme-surface ${CHROME_GLASS_CLASS}`}
        style={{
          ...islandBase,
          background: glass.bg,
          position: 'relative',
          padding: 10,
          cursor: 'pointer',
        }}
      >
        <Bell size={16} color="var(--ui-text)" strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span
            aria-label={`${unreadCount} unread`}
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: '#f05050',
              boxShadow: '0 0 0 1.5px rgba(255,255,255,0.8)',
            }}
          />
        )}
      </button>

      <button
        onClick={onProfileClick}
        aria-label={`Profile: ${user.name}`}
        data-panel-trigger="profile"
        className={`theme-surface ${CHROME_GLASS_CLASS}`}
        style={{
          ...islandBase,
          background: glass.bg,
          gap: 8,
          padding: '6px 12px 6px 8px',
          cursor: 'pointer',
        }}
      >
        <UserAvatar
          displayName={user.name}
          avatarColor={user.avatarColor}
          avatarImageUrl={user.avatarImageUrl}
          size={24}
          fontSize={11}
        />
        <span
          className={CHROME_PRESERVE_CASE_CLASS}
          style={{ fontSize: 14, fontWeight: 500, color: font.colorPrimary }}
        >
          {user.name}
        </span>
      </button>
    </div>
  )
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

interface TopBarProps {
  user: UserClusterProps['user']
  unreadCount: number
  cutlineMenuOpen?: boolean
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  onCutlineClick: () => void
  onNotificationClick: () => void
  onProfileClick: () => void
}

export default function TopBar({
  user,
  unreadCount,
  cutlineMenuOpen = false,
  transformRef,
  onCutlineClick,
  onNotificationClick,
  onProfileClick,
}: TopBarProps) {
  return (
    <div
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
          pointerEvents: 'auto',
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
          onNotificationClick={onNotificationClick}
          onProfileClick={onProfileClick}
        />
      </div>
    </div>
  )
}

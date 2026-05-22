import { useRef, useState } from 'react'
import { Search, Bell } from 'lucide-react'
import { glass, font } from '../styles/tokens'

const islandStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  background: glass.bg,
  backdropFilter: glass.blur,
  WebkitBackdropFilter: glass.blur,
  border: glass.border,
  boxShadow: glass.shadow,
  borderRadius: glass.radius,
  fontFamily: font.family,
  color: font.colorPrimary,
  userSelect: 'none',
}

// ─── Brand Pill ───────────────────────────────────────────────────────────────

export function BrandPill() {
  return (
    <div style={{ ...islandStyle, gap: 8, padding: '8px 16px' }}>
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
    </div>
  )
}

// ─── Search Bar ───────────────────────────────────────────────────────────────

interface SearchBarProps {
  onSearch: (query: string) => void
  placeholder?: string
}

export function SearchBar({ onSearch, placeholder = 'Search…' }: SearchBarProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value)
    onSearch(e.target.value)
  }

  return (
    <div
      style={{
        ...islandStyle,
        gap: 8,
        padding: '8px 14px',
        width: '100%',
        maxWidth: 480,
        cursor: 'text',
      }}
      onClick={() => inputRef.current?.focus()}
    >
      <Search
        size={15}
        color={font.colorMuted}
        strokeWidth={2}
        style={{ flexShrink: 0 }}
      />
      <input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        style={{
          flex: 1,
          border: 'none',
          background: 'transparent',
          outline: 'none',
          fontSize: 14,
          fontFamily: font.family,
          color: font.colorPrimary,
          minWidth: 0,
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          flexShrink: 0,
          opacity: value ? 0 : 1,
          transition: 'opacity 0.15s ease',
        }}
      >
        <kbd
          style={{
            fontSize: 11,
            fontFamily: font.family,
            color: font.colorFaint,
            background: 'rgba(20, 30, 50, 0.06)',
            border: '1px solid rgba(20, 30, 50, 0.1)',
            borderRadius: 5,
            padding: '1px 5px',
            lineHeight: '16px',
          }}
        >
          ⌘K
        </kbd>
      </div>
    </div>
  )
}

// ─── User Cluster ─────────────────────────────────────────────────────────────

interface UserClusterProps {
  user: { name: string; initial: string; avatarColor: string }
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
      {/* Bell */}
      <button
        onClick={onNotificationClick}
        aria-label="Notifications"
        data-panel-trigger="notifications"
        style={{
          ...islandStyle,
          position: 'relative',
          padding: 10,
          cursor: 'pointer',
          border: glass.border,
        }}
      >
        <Bell size={16} color={font.colorPrimary} strokeWidth={1.8} />
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

      {/* Profile pill */}
      <button
        onClick={onProfileClick}
        aria-label={`Profile: ${user.name}`}
        data-panel-trigger="profile"
        style={{
          ...islandStyle,
          gap: 8,
          padding: '6px 12px 6px 8px',
          cursor: 'pointer',
          border: glass.border,
        }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            backgroundColor: user.avatarColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: '#fff',
            flexShrink: 0,
            letterSpacing: '0.02em',
          }}
        >
          {user.initial}
        </span>
        <span style={{ fontSize: 14, fontWeight: 500, color: font.colorPrimary }}>
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
  onSearch: (query: string) => void
  onNotificationClick: () => void
  onProfileClick: () => void
}

export default function TopBar({
  user,
  unreadCount,
  onSearch,
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
        <BrandPill />
      </div>
      <div
        style={{
          pointerEvents: 'auto',
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <SearchBar onSearch={onSearch} placeholder="Search…" />
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

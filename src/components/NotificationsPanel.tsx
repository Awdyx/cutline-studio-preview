import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BellOff } from 'lucide-react'
import { card, font } from '../styles/tokens'
import type { Notification, NotificationTab } from '../types'

interface NotificationsPanelProps {
  isOpen: boolean
  onClose: () => void
  notifications: Notification[]
  activeTab: NotificationTab
  onTabChange: (tab: NotificationTab) => void
  onMarkAllRead: () => void
  onNotificationClick: (id: string) => void
}

const TABS: { key: NotificationTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'mentions', label: 'Mentions' },
]

const cardBase: React.CSSProperties = {
  position: 'fixed',
  top: 64,
  right: 80,
  width: 360,
  maxHeight: 480,
  background: card.bg,
  backdropFilter: card.blur,
  WebkitBackdropFilter: card.blur,
  border: card.border,
  boxShadow: card.shadow,
  borderRadius: card.radius,
  fontFamily: font.family,
  color: font.colorPrimary,
  zIndex: 30,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

function NotificationRow({
  n,
  onClick,
}: {
  n: Notification
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        width: '100%',
        padding: '11px 16px',
        background: hovered ? 'rgba(20, 30, 50, 0.04)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 150ms ease',
        fontFamily: font.family,
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          backgroundColor: n.avatar.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 700,
          color: '#fff',
          flexShrink: 0,
          letterSpacing: '0.02em',
        }}
      >
        {n.avatar.initial}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: n.isUnread ? 500 : 400,
            color: font.colorPrimary,
            lineHeight: '1.45',
          }}
        >
          {n.message}
        </p>
        <p
          style={{
            margin: '3px 0 0',
            fontSize: 12,
            color: font.colorMuted,
          }}
        >
          {n.timestamp}
        </p>
      </div>
      {n.isUnread && (
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: '#3a86c8',
            flexShrink: 0,
            marginTop: 5,
          }}
        />
      )}
    </button>
  )
}

function EmptyState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        gap: 10,
      }}
    >
      <BellOff size={22} color={font.colorFaint} strokeWidth={1.5} />
      <p style={{ margin: 0, fontSize: 13, color: font.colorMuted }}>
        You're all caught up.
      </p>
    </div>
  )
}

export default function NotificationsPanel({
  isOpen,
  onClose,
  notifications,
  activeTab,
  onTabChange,
  onMarkAllRead,
  onNotificationClick,
}: NotificationsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handleMouseDown(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !(e.target as Element).closest('[data-panel-trigger="notifications"]')
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isOpen, onClose])

  const filtered = notifications.filter((n) => {
    if (activeTab === 'unread') return n.isUnread
    if (activeTab === 'mentions') return n.type === 'mention'
    return true
  })

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
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 16px 0',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 600 }}>Notifications</span>
        <button
          onClick={onMarkAllRead}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontSize: 13,
            color: font.colorMuted,
            fontFamily: font.family,
          }}
        >
          Mark all read
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          padding: '10px 16px 0',
          flexShrink: 0,
          borderBottom: '1px solid rgba(20, 30, 50, 0.07)',
        }}
      >
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom:
                activeTab === key
                  ? '2px solid #1a2230'
                  : '2px solid transparent',
              marginBottom: -1,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === key ? 600 : 400,
              color: activeTab === key ? font.colorPrimary : font.colorMuted,
              fontFamily: font.family,
              transition: 'color 150ms ease',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          filtered.map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              onClick={() => onNotificationClick(n.id)}
            />
          ))
        )}
      </div>
    </motion.div>
  )
}

import { useRef, useEffect, useState, useCallback, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  type PanInfo,
} from 'framer-motion'
import { BellOff, Trash2 } from 'lucide-react'
import {
  CHROME_CARD_CLASS,
  CHROME_PRESERVE_CASE_CLASS,
  card,
  chromeLabel,
  font,
} from '../styles/tokens'
import { partitionNewOld, PanelNewOldDivider } from './PanelNewOldDivider'
import {
  NotificationActorLink,
  NotificationActorProfileAvatarTrigger,
  NotificationActorProfileTextTrigger,
  NotificationProfilePreviewScope,
  useNotificationActorProfileContext,
} from './NotificationProfilePreview'
import { NOTIFICATION_ACTOR_PROFILES } from '../content/notificationActorProfiles'
import type { Notification, NotificationTab } from '../types'
import UserAvatar from './UserAvatar'

interface NotificationsPanelProps {
  isOpen: boolean
  onClose: () => void
  notifications: Notification[]
  activeTab: NotificationTab
  onTabChange: (tab: NotificationTab) => void
  onNotificationClick: (id: string) => void
  onDeleteNotification: (id: string) => void
  onVisitActorCanvas?: (handle: string) => void
}

const TABS: { key: NotificationTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'mentions', label: 'Mentions' },
]

const panelTone = {
  title: font.colorPrimary,
  tabActive: font.colorPrimary,
  tabInactive: font.colorMuted,
  tabUnderline: 'rgba(26, 34, 48, 0.55)',
  rowHover: 'rgba(20, 30, 50, 0.04)',
} as const

/** Visual weight — higher layers read first; chrome recedes. */
const opacity = {
  title: 1,
  subtitle: 0.68,
  tabActive: 1,
  tabInactive: 0.52,
  tabUnderline: 0.42,
  timestamp: 0.46,
  emptyIcon: 0.4,
  emptyText: 0.62,
} as const

const cardBase: React.CSSProperties = {
  position: 'fixed',
  top: 64,
  right: 80,
  width: 360,
  height: 'min(72vh, 520px)',
  background: card.bg,
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

const timestampStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 400,
  letterSpacing: '0.04em',
  color: font.colorMuted,
  flexShrink: 0,
  paddingTop: 2,
}

function NotificationMessage({
  actor,
  message,
  onVisitActorCanvas,
}: {
  actor?: string
  message: string
  onVisitActorCanvas?: (handle: string) => void
}) {
  if (!actor) {
    return <>{message}</>
  }

  const rest = message.startsWith(actor) ? message.slice(actor.length) : message
  const profile = NOTIFICATION_ACTOR_PROFILES[actor]
  const inProfileScope = useNotificationActorProfileContext() !== null

  if (inProfileScope && profile) {
    return (
      <>
        <NotificationActorProfileTextTrigger profile={profile}>
          {actor}
        </NotificationActorProfileTextTrigger>
        {rest}
      </>
    )
  }

  if (profile) {
    return (
      <>
        <NotificationActorLink profile={profile} onVisitCanvas={onVisitActorCanvas}>
          {actor}
        </NotificationActorLink>
        {rest}
      </>
    )
  }

  return (
    <>
      <span style={{ fontStyle: 'italic', fontWeight: 600 }}>{actor}</span>
      {rest}
    </>
  )
}

const SWIPE_REVEAL_PX = 64
const ACTION_RADIUS = 11
const DELETE_BACKDROP_INSET = { top: 6, right: 8, bottom: 6, left: 6 }
const SWIPE_RUBBER_BAND = 0.22
const swipeSpring = { type: 'spring' as const, stiffness: 260, damping: 34, mass: 1.05 }
const TRACKPAD_WHEEL_SNAP_MS = 200
const TRACKPAD_WHEEL_SCALE = 0.88
const collapseSpring = { type: 'spring' as const, stiffness: 360, damping: 32, mass: 0.9 }

function applySwipeX(raw: number): number {
  if (raw > 0) return raw * SWIPE_RUBBER_BAND
  if (raw >= -SWIPE_REVEAL_PX) return raw
  const excess = -raw - SWIPE_REVEAL_PX
  return -(SWIPE_REVEAL_PX + excess * SWIPE_RUBBER_BAND)
}

function resolveSwipeOpen(offset: number, velocityX = 0): boolean {
  if (velocityX > 380) return false
  if (velocityX < -420) return true
  return offset < -SWIPE_REVEAL_PX * 0.42
}

function NotificationRow({
  n,
  onClick,
  onDelete,
  onVisitActorCanvas,
  isRevealed,
  onReveal,
  onCloseReveal,
}: {
  n: Notification
  onClick: () => void
  onDelete: () => void
  onVisitActorCanvas?: (handle: string) => void
  isRevealed: boolean
  onReveal: () => void
  onCloseReveal: () => void
}) {
  const [dragging, setDragging] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [rowHeight, setRowHeight] = useState<number | 'auto'>('auto')
  const deletingRef = useRef(false)
  const shellRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const wheelSnapTimerRef = useRef<number | null>(null)
  const wheelActiveRef = useRef(false)
  const x = useMotionValue(0)
  const removeFade = useMotionValue(1)
  const deleteOpacity = useTransform(
    x,
    [0, -12, -SWIPE_REVEAL_PX * 0.55, -SWIPE_REVEAL_PX],
    [0, 0, 0.45, 1],
  )

  useEffect(() => {
    if (isRemoving) return
    animate(x, isRevealed ? -SWIPE_REVEAL_PX : 0, swipeSpring)
  }, [isRevealed, isRemoving, x])

  const snapReveal = useCallback(
    (open: boolean) => {
      if (isRemoving) return
      if (open) onReveal()
      else onCloseReveal()
      animate(x, open ? -SWIPE_REVEAL_PX : 0, swipeSpring)
    },
    [isRemoving, onCloseReveal, onReveal, x],
  )

  const finishSwipe = useCallback(
    (offset: number) => {
      wheelActiveRef.current = false
      setDragging(false)
      snapReveal(resolveSwipeOpen(offset))
    },
    [snapReveal],
  )

  useEffect(() => {
    const el = rowRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      if (isRemoving) return
      const absX = Math.abs(e.deltaX)
      const absY = Math.abs(e.deltaY)
      if (absX < 2 || absX <= absY) return

      e.preventDefault()

      if (!wheelActiveRef.current) {
        wheelActiveRef.current = true
        setDragging(true)
        if (!isRevealed) onCloseReveal()
      }

      const next = applySwipeX(x.get() - e.deltaX * TRACKPAD_WHEEL_SCALE)
      x.set(next)

      if (wheelSnapTimerRef.current !== null) {
        window.clearTimeout(wheelSnapTimerRef.current)
      }
      wheelSnapTimerRef.current = window.setTimeout(() => {
        wheelSnapTimerRef.current = null
        finishSwipe(x.get())
      }, TRACKPAD_WHEEL_SNAP_MS)
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', handleWheel)
      if (wheelSnapTimerRef.current !== null) {
        window.clearTimeout(wheelSnapTimerRef.current)
      }
    }
  }, [finishSwipe, isRevealed, isRemoving, onCloseReveal, x])

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (isRemoving) return
    wheelActiveRef.current = false
    setDragging(false)
    snapReveal(resolveSwipeOpen(info.offset.x, info.velocity.x))
  }

  function handleRowClick() {
    if (isRemoving) return
    if (isRevealed) {
      snapReveal(false)
      return
    }
    onCloseReveal()
    onClick()
  }

  const handleDelete = useCallback(
    async (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      e.preventDefault()
      if (isRemoving) return

      setIsRemoving(true)
      deletingRef.current = true
      onCloseReveal()
      wheelActiveRef.current = false
      setDragging(false)

      await animate(removeFade, 0, { duration: 0.16, ease: 'easeOut' })

      const measured = shellRef.current?.offsetHeight ?? 0
      if (measured > 0) {
        setRowHeight(measured)
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })
        setRowHeight(0)
      } else {
        deletingRef.current = false
        onDelete()
      }
    },
    [isRemoving, onCloseReveal, onDelete, removeFade, x],
  )

  const actorProfile = n.actor ? NOTIFICATION_ACTOR_PROFILES[n.actor] : undefined

  const rowBody = (
    <>
      {actorProfile ? (
        <NotificationActorProfileAvatarTrigger
          profile={actorProfile}
          displayName={n.avatar.initial}
          avatarColor={n.avatar.color}
          avatarImageUrl={actorProfile.avatarImageUrl}
          size={32}
          fontSize={12}
        />
      ) : (
        <span style={{ flexShrink: 0 }}>
          <UserAvatar
            displayName={n.avatar.initial}
            avatarColor={n.avatar.color}
            size={32}
            fontSize={12}
          />
        </span>
      )}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
        }}
      >
        <p
          className={CHROME_PRESERVE_CASE_CLASS}
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 400,
            color: font.colorPrimary,
            lineHeight: 1.35,
            flex: 1,
            minWidth: 0,
          }}
        >
          <NotificationMessage
            actor={n.actor}
            message={n.message}
            onVisitActorCanvas={onVisitActorCanvas}
          />
        </p>
        <span style={{ ...timestampStyle, opacity: opacity.timestamp }}>
          {chromeLabel(n.timestamp)}
        </span>
      </div>
    </>
  )

  return (
    <motion.div
      layout
      initial={false}
      animate={{ height: rowHeight }}
      transition={{ height: { duration: 0.22, ease: [0.4, 0, 0.2, 1] }, layout: collapseSpring }}
      style={{ overflow: 'hidden' }}
      onAnimationComplete={() => {
        if (deletingRef.current && rowHeight === 0) {
          deletingRef.current = false
          onDelete()
        }
      }}
    >
      <div
        ref={shellRef}
        style={{
          position: 'relative',
          width: '100%',
          overflow: 'hidden',
        }}
      >
        <motion.div
          aria-hidden
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: SWIPE_REVEAL_PX,
            boxSizing: 'border-box',
            padding: `${DELETE_BACKDROP_INSET.top}px ${DELETE_BACKDROP_INSET.right}px ${DELETE_BACKDROP_INSET.bottom}px ${DELETE_BACKDROP_INSET.left}px`,
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'center',
            opacity: deleteOpacity,
            pointerEvents: isRemoving ? 'none' : isRevealed || dragging ? 'auto' : 'none',
            zIndex: 0,
          }}
        >
          <button
            type="button"
            aria-label="Delete notification"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleDelete}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: ACTION_RADIUS,
              border: 'none',
              background: 'rgba(196, 78, 78, 0.14)',
              color: '#c44e4e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Trash2 size={16} strokeWidth={2} />
          </button>
        </motion.div>

        <motion.div
          ref={rowRef}
          role="button"
          tabIndex={isRemoving ? -1 : 0}
          drag={isRemoving ? false : 'x'}
          dragConstraints={{ left: -SWIPE_REVEAL_PX, right: 0 }}
          dragElastic={{ left: 0.18, right: 0.18 }}
          dragDirectionLock
          dragMomentum={false}
          onDragStart={() => {
            if (isRemoving) return
            wheelActiveRef.current = false
            setDragging(true)
            if (!isRevealed) onCloseReveal()
          }}
          onDragEnd={handleDragEnd}
          onClick={handleRowClick}
          onKeyDown={(e) => {
            if (isRemoving) return
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleRowClick()
            }
          }}
          style={{
            x,
            opacity: isRemoving ? removeFade : 1,
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            width: '100%',
            padding: '14px 16px',
            background: 'transparent',
            boxShadow: 'none',
            cursor: isRemoving ? 'default' : 'pointer',
            textAlign: 'left',
            fontFamily: font.family,
            touchAction: 'pan-y',
            pointerEvents: isRemoving ? 'none' : 'auto',
          }}
        >
          {rowBody}
        </motion.div>
      </div>
    </motion.div>
  )
}

function AllDeletedEmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1], delay: 0.08 }}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <p style={{ margin: 0, fontSize: 13, color: font.colorMuted, opacity: opacity.emptyText }}>
        {chromeLabel('No new notifications')}
      </p>
    </motion.div>
  )
}

function EmptyState({ tab }: { tab: NotificationTab }) {
  const copy =
    tab === 'unread'
      ? 'No unread notifications.'
      : tab === 'mentions'
        ? 'No mentions yet.'
        : 'No notifications yet.'

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
      <BellOff size={22} color={font.colorFaint} strokeWidth={1.5} style={{ opacity: opacity.emptyIcon }} />
      <p style={{ margin: 0, fontSize: 13, color: font.colorMuted, opacity: opacity.emptyText }}>
        {chromeLabel(copy)}
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
  onNotificationClick,
  onDeleteNotification,
  onVisitActorCanvas,
}: NotificationsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [revealedId, setRevealedId] = useState<string | null>(null)

  useEffect(() => {
    setRevealedId(null)
  }, [activeTab])

  const filtered = notifications.filter((n) => {
    if (activeTab === 'unread') return n.isUnread
    if (activeTab === 'mentions') return n.type === 'mention'
    return true
  })
  const { newItems, oldItems } = partitionNewOld(filtered, (n) => n.isUnread)

  return (
    <NotificationProfilePreviewScope
      isActive={isOpen}
      panelRef={panelRef}
      onClosePanel={onClose}
      onVisitCanvas={onVisitActorCanvas}
    >
      <motion.div
        ref={panelRef}
        data-notifications-panel=""
        className={`theme-surface ${CHROME_CARD_CLASS}`}
        style={cardBase}
        initial={{ opacity: 0, scale: 0.96, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -4 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
      <div
        style={{
          padding: '16px 16px 0',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 400, color: panelTone.title, opacity: opacity.title }}>
            {chromeLabel('Notifications')}
          </span>
        </div>
        <p
          style={{
            margin: '4px 0 0',
            fontSize: 12,
            color: font.colorMuted,
            lineHeight: 1.4,
            opacity: opacity.subtitle,
          }}
        >
          {chromeLabel('Comments, shares, and mentions')}
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 0,
          padding: '10px 16px 4px',
          flexShrink: 0,
        }}
      >
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onTabChange(key)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom:
                activeTab === key
                  ? `2px solid rgba(26, 34, 48, ${opacity.tabUnderline})`
                  : '2px solid transparent',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 400,
              color:
                activeTab === key ? panelTone.tabActive : panelTone.tabInactive,
              fontFamily: font.family,
              opacity: activeTab === key ? opacity.tabActive : opacity.tabInactive,
              transition: 'color 150ms ease, opacity 150ms ease',
            }}
          >
            {chromeLabel(label)}
          </button>
        ))}
      </div>

      <div
        style={{
          overflowY: 'auto',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: '4px 0 12px',
        }}
      >
        {notifications.length === 0 ? (
          <AllDeletedEmptyState />
        ) : filtered.length === 0 ? (
          <EmptyState tab={activeTab} />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {newItems.map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                isRevealed={revealedId === n.id}
                onReveal={() => setRevealedId(n.id)}
                onCloseReveal={() => setRevealedId(null)}
                onClick={() => onNotificationClick(n.id)}
                onDelete={() => onDeleteNotification(n.id)}
                onVisitActorCanvas={onVisitActorCanvas}
              />
            ))}
            {newItems.length > 0 && oldItems.length > 0 && (
              <PanelNewOldDivider label="Older notifications" />
            )}
            {oldItems.map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                isRevealed={revealedId === n.id}
                onReveal={() => setRevealedId(n.id)}
                onCloseReveal={() => setRevealedId(null)}
                onClick={() => onNotificationClick(n.id)}
                onDelete={() => onDeleteNotification(n.id)}
                onVisitActorCanvas={onVisitActorCanvas}
              />
            ))}
          </div>
        )}
      </div>
      </motion.div>
    </NotificationProfilePreviewScope>
  )
}

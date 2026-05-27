import { useRef, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { Bell, BellOff } from 'lucide-react'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import { CHROME_FROSTED_MENU_CLASS, CHROME_PRESERVE_CASE_CLASS, chromeFrostedMenuStyle, chromeLabel, font } from '../styles/tokens'
import { phonePanelSheetStyle, phoneTopPanelSlideMotion, phoneTopPanelTransformOrigin, PHONE_TOP_PANEL_SCALE } from '../styles/phoneChrome'
import { partitionNewOld, PanelNewOldDivider } from './PanelNewOldDivider'
import ChromeScrollFade from './ChromeScrollFade'
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
  rowHover: 'var(--menu-row-hover-bg)',
} as const

/** Visual weight — higher layers read first; chrome recedes. */
const opacity = {
  title: 1,
  subtitle: 0.68,
  tabActive: 1,
  tabInactive: 0.52,
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
  ...chromeFrostedMenuStyle,
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

function NotificationRow({
  n,
  onClick,
  onVisitActorCanvas,
}: {
  n: Notification
  onClick: () => void
  onVisitActorCanvas?: (handle: string) => void
}) {
  const actorProfile = n.actor ? NOTIFICATION_ACTOR_PROFILES[n.actor] : undefined

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        width: '100%',
        padding: '14px 16px',
        background: 'transparent',
        boxShadow: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: font.family,
      }}
    >
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
            maxWidth: 190,
          }}
        >
          <NotificationMessage
            actor={n.actor}
            message={n.message}
            onVisitActorCanvas={onVisitActorCanvas}
          />
        </p>
        <span style={{ ...timestampStyle, opacity: opacity.timestamp, marginLeft: 'auto' }}>
          {chromeLabel(n.timestamp)}
        </span>
      </div>
    </div>
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

export default function NotificationsPanel(props: NotificationsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  return (
    <NotificationProfilePreviewScope
      isActive={props.isOpen}
      panelRef={panelRef}
      onClosePanel={props.onClose}
      onVisitCanvas={props.onVisitActorCanvas}
    >
      <NotificationsPanelBody {...props} panelRef={panelRef} />
    </NotificationProfilePreviewScope>
  )
}

function NotificationsPanelBody({
  notifications,
  activeTab,
  onTabChange,
  onNotificationClick,
  onVisitActorCanvas,
  panelRef,
}: NotificationsPanelProps & {
  panelRef: React.RefObject<HTMLDivElement | null>
}) {
  const isPhone = useIsPhoneLayout()

  const filtered = notifications.filter((n) => {
    if (activeTab === 'unread') return n.isUnread
    if (activeTab === 'mentions') return n.type === 'mention'
    return true
  })
  const { newItems, oldItems } = partitionNewOld(filtered, (n) => n.isUnread)

  return (
      <motion.div
        ref={panelRef}
        data-notifications-panel=""
        className={`theme-surface ${CHROME_FROSTED_MENU_CLASS}`}
        style={{
          ...(isPhone
            ? {
                ...phonePanelSheetStyle({ height: undefined }, 'right', PHONE_TOP_PANEL_SCALE),
                transformOrigin: phoneTopPanelTransformOrigin,
              }
            : cardBase),
          ...chromeFrostedMenuStyle,
          fontFamily: font.family,
          color: font.colorPrimary,
          zIndex: 30,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          ...(isPhone ? {} : { height: cardBase.height }),
        }}
        {...(isPhone ? phoneTopPanelSlideMotion : {
          initial: { opacity: 0, scale: 0.96, y: -4 },
          animate: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0, scale: 0.96, y: -4 },
          transition: { duration: 0.18, ease: 'easeOut' },
        })}
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
            gap: 8,
          }}
        >
          <Bell size={16} color={panelTone.title} strokeWidth={1.8} aria-hidden />
          <span style={{ fontSize: 16, fontWeight: 600, color: panelTone.title, opacity: opacity.title }}>
            {chromeLabel('Notifications')}
          </span>
        </div>
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
                  ? '2px solid var(--ui-tab-underline)'
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

      <ChromeScrollFade observeDeps={[activeTab, filtered.length]}>
        {filtered.length === 0 ? (
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
                onClick={() => onNotificationClick(n.id)}
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
                onClick={() => onNotificationClick(n.id)}
                onVisitActorCanvas={onVisitActorCanvas}
              />
            ))}
          </div>
        )}
      </ChromeScrollFade>
      </motion.div>
  )
}

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, GraduationCap, LayoutGrid, MessageSquare, Newspaper, Trophy, Users } from 'lucide-react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import { CHROME_GLASS_CLASS, CHROME_PRESERVE_CASE_CLASS, CHROME_TAP_SQUEEZE_TARGET_CLASS, CHROME_SURFACE_BG_TRANSITION, chromeGlassSurfaceBg, glass, font } from '../styles/tokens'
import { APP_DESTINATION_LABELS, useAppDestinationStore } from '../navigation/appDestinationStore'
import { PHONE_HEADER_ROW_GAP } from '../styles/phoneChrome'
import CanvasSearchBar from './CanvasSearchBar'
import ChromeTapSqueezeWrap from './ChromeTapSqueezeWrap'
import UserAvatar from './UserAvatar'
import UiPinHost from '../uiCustomization/UiPinHost'
import { useUiCustomizationStore } from '../uiCustomization/uiCustomizationStore'
import type { ProfileMediaFrame } from '../profile/types'

// ─── Hold menu data ────────────────────────────────────────────────────────────

const HOLD_ITEMS = [
  { id: 'studio',      label: 'studio',      Icon: LayoutGrid },
  { id: 'leaderboard', label: 'rankings', Icon: Trophy },
  { id: 'forum',       label: 'forum',       Icon: MessageSquare },
  { id: 'groups',      label: 'groups',      Icon: Users },
  { id: 'ucat',        label: 'ucat',        Icon: GraduationCap },
] as const

// ─── Coming-soon overlay ───────────────────────────────────────────────────────

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
  /** Stretch pill to fill its column (desktop top bar balance). */
  fullWidth?: boolean
}

export function BrandPill({ isOpen = false, onClick, fullWidth = false }: BrandPillProps) {
  const destination = useAppDestinationStore((s) => s.destination)
  const destinationLabel = APP_DESTINATION_LABELS[destination]
  const [hovered, setHovered] = useState(false)
  const [holdOpen, setHoldOpen] = useState(false)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [comingSoon, setComingSoon] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)

  const editingUi = useUiCustomizationStore((s) => s.editing)
  const showHoverBackground = hovered && !editingUi

  const buttonRef = useRef<HTMLButtonElement>(null)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isHoldRef = useRef(false)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  // Measure menu anchor when hold opens
  useEffect(() => {
    if (holdOpen && buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect()
      setMenuPos({ top: r.bottom + 8, left: r.left })
    }
  }, [holdOpen])

  const cancelHold = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    isHoldRef.current = false
    setHoldOpen(false)
    setHoveredItem(null)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || editingUi) return
    e.currentTarget.setPointerCapture(e.pointerId)
    holdTimerRef.current = setTimeout(() => {
      isHoldRef.current = true
      setHoldOpen(true)
    }, 380)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isHoldRef.current) return
    // Hit-test item rects manually (menu has pointerEvents:none)
    const { clientX, clientY } = e
    let found: string | null = null
    for (let i = 0; i < itemRefs.current.length; i++) {
      const el = itemRefs.current[i]
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        found = HOLD_ITEMS[i].id
        break
      }
    }
    setHoveredItem(found)
  }

  const onPointerUp = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    if (isHoldRef.current) {
      if (hoveredItem && hoveredItem !== 'studio') setComingSoon(true)
      cancelHold()
    } else {
      onClick?.()
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-panel-trigger="cutline"
        data-ui-anchor="brand-pill"
        aria-label="Cutline menu"
        aria-expanded={isOpen}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={cancelHold}
        className={`${CHROME_TAP_SQUEEZE_TARGET_CLASS} theme-surface ${CHROME_GLASS_CLASS}`}
        style={{
          ...islandBase,
          position: 'relative',
          gap: 8,
          padding: '8px 16px',
          width: fullWidth ? '100%' : undefined,
          justifyContent: fullWidth ? 'center' : undefined,
          cursor: 'pointer',
          transition: CHROME_SURFACE_BG_TRANSITION,
          background: chromeGlassSurfaceBg({
            active: isOpen || holdOpen,
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
        <span
          style={{
            fontSize: 14,
            fontWeight: 400,
            color: font.colorMuted,
            opacity: 0.75,
            letterSpacing: '-0.01em',
          }}
        >
          {destinationLabel}
        </span>
        <UiPinHost anchorId="brand-pill" />
      </button>

      {/* Hold submenu — rendered via portal so it floats above everything */}
      {createPortal(
        <AnimatePresence>
          {holdOpen && menuPos && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -4 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28, mass: 0.6 }}
              style={{
                position: 'fixed',
                top: menuPos.top,
                left: menuPos.left,
                zIndex: 9000,
                pointerEvents: 'none',
                transformOrigin: 'top left',
                background: 'var(--card-bg)',
                border: glass.border,
                borderRadius: 16,
                boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1)',
                backdropFilter: 'blur(22px) saturate(1.4)',
                WebkitBackdropFilter: 'blur(22px) saturate(1.4)',
                padding: '6px 0',
                minWidth: 168,
                overflow: 'hidden',
              }}
            >
              {HOLD_ITEMS.map(({ id, label, Icon }, i) => (
                <div
                  key={id}
                  ref={el => { itemRefs.current[i] = el }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 16px',
                    fontFamily: font.family,
                    fontSize: 13,
                    fontWeight: 500,
                    color: hoveredItem === id ? 'var(--ui-text)' : font.colorMuted,
                    background: hoveredItem === id ? 'var(--menu-row-hover-bg)' : 'transparent',
                    transition: 'background 80ms ease, color 80ms ease',
                    borderRadius: 10,
                    margin: '0 4px',
                  }}
                >
                  <Icon size={14} strokeWidth={1.9} style={{ flexShrink: 0, opacity: hoveredItem === id ? 1 : 0.55 }} />
                  {label}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {/* Coming-soon overlay */}
      <AnimatePresence>
        {comingSoon && <ComingSoonOverlay onDismiss={() => setComingSoon(false)} />}
      </AnimatePresence>
    </>
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
        transition: CHROME_SURFACE_BG_TRANSITION,
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
  user: {
    name: string
    initial: string
    avatarColor: string
    avatarImageUrl?: string | null
    avatarFrame?: ProfileMediaFrame | null
  }
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
            gap: compact ? 0 : 8,
            padding: compact ? 6 : '6px 12px 6px 8px',
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
  }, [isPhone, user.name, unreadCount, newsCount])

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

  const sideColumnStyle: React.CSSProperties | undefined = sideColumnWidth
    ? { width: sideColumnWidth, minWidth: sideColumnWidth, maxWidth: sideColumnWidth }
    : undefined

  return (
    <div
      className="cutline-top-bar"
      style={{
        position: 'fixed',
        top: 16,
        left: 16,
        right: 16,
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
      <div style={{ pointerEvents: 'auto', ...sideColumnStyle }}>
        <BrandPill
          isOpen={cutlineMenuOpen}
          onClick={onCutlineClick}
          fullWidth={sideColumnWidth != null}
        />
      </div>
      <div
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
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          justifyContent: 'flex-end',
          ...sideColumnStyle,
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

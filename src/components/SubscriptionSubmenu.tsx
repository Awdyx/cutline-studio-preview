import { useLayoutEffect, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Sparkles,
} from 'lucide-react'
import {
  CHROME_FROSTED_MENU_CLASS,
  CHROME_PRESERVE_CASE_CLASS,
  chromeFrostedMenuStyle,
  chromeLabel,
  font,
  menuDividerStyle,
} from '../styles/tokens'
import { useProfileStore } from '../profile/profileStore'
import {
  formatRenewalDate,
  statusLabel,
  useSubscriptionStore,
} from '../subscription/subscriptionStore'
import { usePanelAlignedSubmenuLayout } from './usePanelAlignedSubmenuLayout'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import { playSubmenuHover, playSubmenuTap } from '../sound/submenuSound'
import { SubmenuSoundScope } from './SubmenuSoundScope'
import ChromeScrollFade from './ChromeScrollFade'
import PhoneCenteredChromeModal from './PhoneCenteredChromeModal'

const SUBMENU_WIDTH = 320
const SUBMENU_GAP = 10

interface SubscriptionSubmenuProps {
  panelRef: RefObject<HTMLElement | null>
  onClose: () => void
  onManageBilling?: () => void
  onChangePlan?: () => void
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '8px 0',
      }}
    >
      <Icon
        size={15}
        strokeWidth={1.8}
        color={font.colorMuted}
        style={{ flexShrink: 0, marginTop: 1 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 11, color: font.colorFaint, fontWeight: 500 }}>
          {chromeLabel(label)}
        </p>
        <p
          className={CHROME_PRESERVE_CASE_CLASS}
          style={{
            margin: '2px 0 0',
            fontSize: 13,
            fontWeight: 500,
            color: font.colorPrimary,
          }}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

function ActionRow({
  label,
  onClick,
  external = false,
}: {
  label: string
  onClick: () => void
  external?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        playSubmenuTap()
        onClick()
      }}
      onMouseEnter={() => {
        setHovered(true)
        playSubmenuHover()
      }}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '10px 0',
        border: 'none',
        background: hovered ? 'var(--menu-row-hover-bg)' : 'transparent',
        borderRadius: 8,
        cursor: 'pointer',
        fontFamily: font.family,
        color: font.colorPrimary,
        fontSize: 14,
        fontWeight: 500,
        textAlign: 'left',
      }}
    >
      <span style={{ flex: 1 }}>{chromeLabel(label)}</span>
      {external ? (
        <ExternalLink size={14} strokeWidth={2} color={font.colorMuted} />
      ) : (
        <ChevronRight size={14} strokeWidth={2} color={font.colorMuted} />
      )}
    </button>
  )
}

export default function SubscriptionSubmenu({
  panelRef,
  onClose,
  onManageBilling,
  onChangePlan,
}: SubscriptionSubmenuProps) {
  const isPhone = useIsPhoneLayout()
  const [mounted, setMounted] = useState(false)
  const subscription = useSubscriptionStore((s) => s.subscription)
  const billingEmail = useProfileStore((s) => s.profile.email)
  const layout = usePanelAlignedSubmenuLayout(panelRef, SUBMENU_WIDTH, SUBMENU_GAP)

  useLayoutEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || (!isPhone && layout.height <= 0)) return null

  const renewalLabel =
    subscription.status === 'canceled'
      ? 'Access until'
      : subscription.status === 'trialing'
        ? 'Trial ends'
        : 'Renews'

  const subscriptionBody = (
    <SubmenuSoundScope>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '14px 14px 10px',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          aria-label="Back"
          onClick={() => {
            playSubmenuTap()
            onClose()
          }}
          onMouseEnter={() => playSubmenuHover()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            border: 'none',
            borderRadius: 8,
            background: 'transparent',
            cursor: 'pointer',
            color: font.colorMuted,
          }}
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, flex: 1 }}>
          {chromeLabel('Subscription')}
        </h2>
      </div>

      <ChromeScrollFade
        scrollStyle={{
          padding: '0 16px',
          ...(isPhone ? { flex: 1, minHeight: 0 } : {}),
        }}
      >
        <div className="subscription-status-card">
          <p className="subscription-status-card__label">
            {chromeLabel('Current subscription')}
          </p>
          <div className="subscription-status-card__row">
            <span
              className={`subscription-status-pill subscription-status-pill--${subscription.status}`}
            >
              {statusLabel(subscription.status)}
            </span>
          </div>
          <p className="subscription-status-card__plan">{subscription.planName}</p>
          <p className="subscription-status-card__price">{subscription.priceLabel}</p>
        </div>

        <div style={menuDividerStyle} />

        <DetailRow icon={Sparkles} label="Plan" value={subscription.planName} />
        <DetailRow
          icon={Calendar}
          label={renewalLabel}
          value={formatRenewalDate(subscription.renewsAt)}
        />
        <DetailRow icon={CreditCard} label="Billing" value={billingEmail} />

        <div style={{ ...menuDividerStyle, marginTop: 10 }} />

        <p
          style={{
            margin: '0 0 8px',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: font.colorMuted,
          }}
        >
          {chromeLabel('Included')}
        </p>
        <ul
          style={{
            margin: 0,
            padding: '0 0 0 18px',
            fontSize: 13,
            color: font.colorPrimary,
            lineHeight: 1.5,
          }}
        >
          {subscription.features.map((feature) => (
            <li key={feature} style={{ marginBottom: 6, color: font.colorMuted }}>
              {feature}
            </li>
          ))}
        </ul>

        <div style={{ ...menuDividerStyle, marginTop: 10 }} />

        <button
          type="button"
          onClick={() => {
            playSubmenuTap()
            onManageBilling?.()
          }}
          onMouseEnter={() => playSubmenuHover()}
          style={{
            width: '100%',
            marginTop: 4,
            padding: '11px 14px',
            borderRadius: 10,
            border: '1px solid var(--glass-border)',
            background: 'rgba(20, 30, 50, 0.04)',
            color: font.colorPrimary,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: font.family,
            cursor: 'pointer',
          }}
        >
          {chromeLabel('Manage billing')}
        </button>

        <ActionRow label="Change plan" onClick={() => onChangePlan?.()} />
        <ActionRow
          label="Billing portal"
          external
          onClick={() => onManageBilling?.()}
        />
      </ChromeScrollFade>
    </SubmenuSoundScope>
  )

  return createPortal(
    isPhone ? (
      <PhoneCenteredChromeModal
        onDismiss={onClose}
        cardDataAttributes={{ 'data-subscription-submenu': '' }}
        maxWidth={SUBMENU_WIDTH}
      >
        {subscriptionBody}
      </PhoneCenteredChromeModal>
    ) : (
      <motion.div
        data-subscription-submenu
        initial={{ opacity: 0, scale: 0.96, x: 8 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.96, x: 8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          top: layout.top,
          left: layout.left,
          width: SUBMENU_WIDTH,
          height: layout.height,
          display: 'flex',
          flexDirection: 'column',
          ...chromeFrostedMenuStyle,
          fontFamily: font.family,
          color: font.colorPrimary,
          zIndex: 45,
          overflow: 'hidden',
        }}
        className={`theme-surface ${CHROME_FROSTED_MENU_CLASS}`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {subscriptionBody}
      </motion.div>
    ),
    document.body,
  )
}

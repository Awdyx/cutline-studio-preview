import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, X } from 'lucide-react'
import { CHROME_CARD_CLASS, card, chromeLabel, font } from '../styles/tokens'
import { WHATS_NEW_RELEASES } from '../content/whatsNew'

interface WhatsNewPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function WhatsNewPanel({ isOpen, onClose }: WhatsNewPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    function handleMouseDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isOpen, onClose])

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -4 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        top: 80,
        left: 16,
        width: 360,
        maxHeight: 'min(72vh, 520px)',
        display: 'flex',
        flexDirection: 'column',
        background: card.bg,
        border: card.border,
        boxShadow: card.shadow,
        borderRadius: card.radius,
        fontFamily: font.family,
        color: font.colorPrimary,
        zIndex: 30,
        overflow: 'hidden',
      }}
      className={`theme-surface ${CHROME_CARD_CLASS}`}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '16px 20px 12px',
          flexShrink: 0,
        }}
      >
        <Sparkles size={18} strokeWidth={1.8} color={font.colorMuted} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{chromeLabel("What's new")}</div>
          <div style={{ fontSize: 12, color: font.colorMuted, marginTop: 2 }}>
            {chromeLabel('Highlights from building Cutline Studio')}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            border: 'none',
            borderRadius: 8,
            background: 'transparent',
            cursor: 'pointer',
            color: font.colorMuted,
          }}
          className="theme-surface"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(20, 30, 50, 0.06)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 20px 20px',
        }}
      >
        {WHATS_NEW_RELEASES.map((release, index) => (
          <section
            key={release.version}
            style={{
              marginBottom: index < WHATS_NEW_RELEASES.length - 1 ? 20 : 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: 'var(--ui-accent)',
                }}
              >
                v{release.version}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{chromeLabel(release.title)}</span>
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                listStyle: 'disc',
              }}
            >
              {release.highlights.map((item) => (
                <li
                  key={item}
                  style={{
                    fontSize: 13,
                    lineHeight: 1.45,
                    color: font.colorPrimary,
                    marginBottom: 6,
                  }}
                >
                  {chromeLabel(item)}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </motion.div>
  )
}

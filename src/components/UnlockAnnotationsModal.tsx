import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { CHROME_CARD_CLASS, card, chromeLabel, font } from '../styles/tokens'

interface UnlockAnnotationsModalProps {
  isOpen: boolean
  onKeep: () => void
  onDiscard: () => void
  onCancel: () => void
}

const buttonBase: React.CSSProperties = {
  flex: 1,
  padding: '10px 12px',
  borderRadius: 10,
  border: 'none',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: font.family,
  cursor: 'pointer',
  transition: 'background 150ms ease, opacity 150ms ease',
}

export default function UnlockAnnotationsModal({
  isOpen,
  onKeep,
  onDiscard,
  onCancel,
}: UnlockAnnotationsModalProps) {
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
    <motion.div
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onMouseDown={onCancel}
      className="ui-chrome-scrim"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(12, 18, 32, 0.36)',
      }}
    >
      <motion.div
        role="dialog"
        aria-labelledby="unlock-annotations-title"
        aria-describedby="unlock-annotations-desc"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onMouseDown={(e) => e.stopPropagation()}
        className={`theme-surface ${CHROME_CARD_CLASS}`}
        style={{
          width: 'min(400px, calc(100vw - 32px))',
          padding: '22px 20px 18px',
          background: card.bg,
          border: card.border,
          boxShadow: card.shadow,
          borderRadius: card.radius,
          fontFamily: font.family,
          color: font.colorPrimary,
        }}
      >
        <h2
          id="unlock-annotations-title"
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 650,
            letterSpacing: '-0.02em',
          }}
        >
          {chromeLabel('Keep annotations?')}
        </h2>
        <p
          id="unlock-annotations-desc"
          style={{
            margin: '8px 0 18px',
            fontSize: 13,
            lineHeight: 1.45,
            color: font.colorMuted,
          }}
        >
          {chromeLabel(
            'You added notes and marks while the canvas was locked. Choose what to do with them.',
          )}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onKeep}
            style={{
              ...buttonBase,
              background: 'var(--ui-accent)',
              color: '#fff',
            }}
          >
            {chromeLabel('Keep annotations')}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            style={{
              ...buttonBase,
              background: 'rgba(20, 30, 50, 0.08)',
              color: font.colorPrimary,
            }}
            className="theme-surface"
          >
            {chromeLabel('Discard')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              ...buttonBase,
              flex: '0 0 auto',
              minWidth: 72,
              background: 'transparent',
              color: font.colorMuted,
            }}
          >
            {chromeLabel('Cancel')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

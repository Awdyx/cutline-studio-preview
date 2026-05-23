import { useLayoutEffect, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Sun, Moon, Monitor, Check } from 'lucide-react'
import { CHROME_CARD_CLASS, card, chromeLabel, font } from '../styles/tokens'
import type { ThemeMode } from '../theme/themeStore'
import { useSubmenuPosition } from './useSubmenuPosition'

const OPTIONS: { mode: ThemeMode; icon: React.ElementType; label: string }[] = [
  { mode: 'light', icon: Sun, label: 'Light' },
  { mode: 'dark', icon: Moon, label: 'Dark' },
  { mode: 'auto', icon: Monitor, label: 'Auto' },
]

interface ThemeSubmenuProps {
  anchorRef: RefObject<HTMLElement | null>
  currentMode: ThemeMode
  onSelect: (mode: ThemeMode) => void
  onClose: () => void
}

export default function ThemeSubmenu({
  anchorRef,
  currentMode,
  onSelect,
  onClose,
}: ThemeSubmenuProps) {
  const [mounted, setMounted] = useState(false)
  const pos = useSubmenuPosition(anchorRef)

  useLayoutEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <motion.div
      data-cutline-submenu="theme"
      initial={{ opacity: 0, scale: 0.96, x: -4 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.96, x: -4 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: 160,
        background: card.bg,
        border: card.border,
        boxShadow: card.shadow,
        borderRadius: card.radius,
        fontFamily: font.family,
        overflow: 'hidden',
        zIndex: 50,
      }}
      className={`theme-surface ${CHROME_CARD_CLASS}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {OPTIONS.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          type="button"
          onClick={() => {
            onSelect(mode)
            onClose()
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '10px 14px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontFamily: font.family,
            color: font.colorPrimary,
          }}
          className="theme-surface"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <Icon size={15} strokeWidth={1.8} color={font.colorMuted} />
          <span style={{ flex: 1, fontSize: 14, textAlign: 'left' }}>{chromeLabel(label)}</span>
          {currentMode === mode && (
            <Check size={14} strokeWidth={2.5} color={font.colorPrimary} />
          )}
        </button>
      ))}
    </motion.div>,
    document.body,
  )
}

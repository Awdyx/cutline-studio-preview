import { useLayoutEffect, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Sun, Moon, Monitor, Check } from 'lucide-react'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import { CHROME_FROSTED_MENU_CLASS, chromeFrostedMenuStyle, chromeLabel, font } from '../styles/tokens'
import { playSubmenuHover } from '../sound/submenuSound'
import type { ThemeMode } from '../theme/themeStore'
import { SubmenuSoundScope } from './SubmenuSoundScope'
import { useSubmenuPosition } from './useSubmenuPosition'
import PhoneStackHeader from './PhoneStackHeader'
import PhoneCenteredChromeModal from './PhoneCenteredChromeModal'

const OPTIONS: { mode: ThemeMode; icon: React.ElementType; label: string }[] = [
  { mode: 'light', icon: Sun, label: 'Light' },
  { mode: 'dark', icon: Moon, label: 'Dark' },
  { mode: 'auto', icon: Monitor, label: 'Auto' },
]

interface ThemeSubmenuProps {
  anchorRef: RefObject<HTMLElement | null>
  currentMode: ThemeMode
  onSelect: (mode: ThemeMode) => void
  onBack?: () => void
}

export default function ThemeSubmenu({
  anchorRef,
  currentMode,
  onSelect,
  onBack,
}: ThemeSubmenuProps) {
  const isPhone = useIsPhoneLayout()
  const [mounted, setMounted] = useState(false)
  const pos = useSubmenuPosition(anchorRef, { enabled: !isPhone })

  useLayoutEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const themeBody = (
    <SubmenuSoundScope>
      {isPhone && onBack ? <PhoneStackHeader title="Theme" onBack={onBack} /> : null}
      {OPTIONS.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          type="button"
          onClick={() => {
            onSelect(mode)
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
            playSubmenuHover()
            e.currentTarget.style.background = 'var(--menu-row-hover-bg)'
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
    </SubmenuSoundScope>
  )

  return createPortal(
    isPhone ? (
      <PhoneCenteredChromeModal
        onDismiss={() => onBack?.()}
        cardDataAttributes={{ 'data-cutline-submenu': 'theme' }}
        maxWidth={300}
        zIndex={60}
      >
        {themeBody}
      </PhoneCenteredChromeModal>
    ) : (
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
          ...chromeFrostedMenuStyle,
          fontFamily: font.family,
          overflow: 'hidden',
          zIndex: 50,
        }}
        className={`theme-surface ${CHROME_FROSTED_MENU_CLASS}`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {themeBody}
      </motion.div>
    ),
    document.body,
  )
}

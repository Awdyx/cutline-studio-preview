import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sun, Moon, Monitor, ChevronRight, Lock, LockOpen, Volume2 } from 'lucide-react'
import { CHROME_CARD_CLASS, card, chromeLabel, font, menuDividerStyle } from '../styles/tokens'
import type { ThemeMode } from '../theme/themeStore'
import { useSoundStore } from '../sound/soundStore'
import { SHORTCUTS_BY_ID } from '../shortcuts/shortcutDefs'
import { useSubmenuPosition } from './useSubmenuPosition'
import { MenuRow } from './MenuRow'
import ThemeSubmenu from './ThemeSubmenu'
import SoundSubmenu from './SoundSubmenu'
import ShortcutTooltip from './ShortcutTooltip'

const MODE_LABELS: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  auto: 'Auto',
}

interface SettingsSubmenuProps {
  anchorRef: RefObject<HTMLElement | null>
  mode: ThemeMode
  onModeChange: (mode: ThemeMode) => void
  onCloseMenu: () => void
  isCanvasLocked: boolean
  onToggleCanvasLock: () => void
  showCanvasLock?: boolean
}

export default function SettingsSubmenu({
  anchorRef,
  mode,
  onModeChange,
  onCloseMenu,
  isCanvasLocked,
  onToggleCanvasLock,
  showCanvasLock = true,
}: SettingsSubmenuProps) {
  const [mounted, setMounted] = useState(false)
  const pos = useSubmenuPosition(anchorRef)
  const soundAnchorRef = useRef<HTMLDivElement>(null)
  const themeAnchorRef = useRef<HTMLDivElement>(null)
  const [soundSubmenuOpen, setSoundSubmenuOpen] = useState(false)
  const [themeSubmenuOpen, setThemeSubmenuOpen] = useState(false)

  const soundMuted = useSoundStore((s) => s.muted)
  const musicEnabled = useSoundStore((s) => s.musicEnabled)

  const soundSummary =
    soundMuted && !musicEnabled
      ? 'Off'
      : !soundMuted && musicEnabled
        ? 'On'
        : soundMuted
          ? 'Music'
          : 'SFX'

  useLayoutEffect(() => {
    setMounted(true)
  }, [])

  const ThemeIcon = mode === 'dark' ? Moon : mode === 'light' ? Sun : Monitor

  if (!mounted) return null

  return createPortal(
    <>
      <motion.div
        data-cutline-submenu="settings"
        initial={{ opacity: 0, scale: 0.96, x: -4 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.96, x: -4 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          width: 260,
          background: card.bg,
          border: card.border,
          boxShadow: card.shadow,
          borderRadius: card.radius,
          fontFamily: font.family,
          overflow: 'visible',
          zIndex: 40,
        }}
        className={`theme-surface ${CHROME_CARD_CLASS}`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {showCanvasLock && (
          <>
            <ShortcutTooltip
              keys={SHORTCUTS_BY_ID['toggle-lock'].keys}
              style={{ display: 'block', width: '100%' }}
            >
              <MenuRow
                icon={isCanvasLocked ? LockOpen : Lock}
                label={isCanvasLocked ? 'Unlock canvas' : 'Lock canvas'}
                onClick={() => {
                  onToggleCanvasLock()
                  onCloseMenu()
                }}
              />
            </ShortcutTooltip>
            <div style={menuDividerStyle} />
          </>
        )}
        <div ref={soundAnchorRef}>
          <MenuRow
            icon={Volume2}
            label="Sound"
            right={
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 13,
                  color: font.colorMuted,
                }}
              >
                {chromeLabel(soundSummary)}
                <ChevronRight size={14} strokeWidth={2} />
              </span>
            }
            onClick={() => {
              setThemeSubmenuOpen(false)
              setSoundSubmenuOpen((o) => !o)
            }}
          />
        </div>
        <div ref={themeAnchorRef}>
          <MenuRow
            icon={ThemeIcon}
            label="Theme"
            right={
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 13,
                  color: font.colorMuted,
                }}
              >
                {chromeLabel(MODE_LABELS[mode])}
                <ChevronRight size={14} strokeWidth={2} />
              </span>
            }
            onClick={() => {
              setSoundSubmenuOpen(false)
              setThemeSubmenuOpen((o) => !o)
            }}
          />
        </div>
      </motion.div>

      <AnimatePresence>
        {soundSubmenuOpen && <SoundSubmenu anchorRef={soundAnchorRef} />}
        {themeSubmenuOpen && (
          <ThemeSubmenu
            anchorRef={themeAnchorRef}
            currentMode={mode}
            onSelect={onModeChange}
            onClose={() => {
              setThemeSubmenuOpen(false)
              onCloseMenu()
            }}
          />
        )}
      </AnimatePresence>
    </>,
    document.body,
  )
}

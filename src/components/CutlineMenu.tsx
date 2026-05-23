import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Keyboard, Settings, Sparkles, ChevronRight } from 'lucide-react'
import { CHROME_CARD_CLASS, card, font, menuDividerStyle } from '../styles/tokens'
import type { ThemeMode } from '../theme/themeStore'
import ShortcutsSubmenu from './ShortcutsSubmenu'
import SettingsSubmenu from './SettingsSubmenu'
import { MenuRow } from './MenuRow'

export type CutlineMenuDestination = 'whats-new'

interface CutlineMenuProps {
  isOpen: boolean
  onClose: () => void
  mode: ThemeMode
  onModeChange: (mode: ThemeMode) => void
  onNavigate: (destination: CutlineMenuDestination) => void
  isCanvasLocked: boolean
  onToggleCanvasLock: () => void
  /** Lock is main-canvas-only; hidden inside a space. */
  showCanvasLock?: boolean
}

export default function CutlineMenu({
  isOpen,
  onClose,
  mode,
  onModeChange,
  onNavigate,
  isCanvasLocked,
  onToggleCanvasLock,
  showCanvasLock = true,
}: CutlineMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const settingsAnchorRef = useRef<HTMLDivElement>(null)
  const shortcutsAnchorRef = useRef<HTMLDivElement>(null)
  const [settingsSubmenuOpen, setSettingsSubmenuOpen] = useState(false)
  const [shortcutsSubmenuOpen, setShortcutsSubmenuOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setSettingsSubmenuOpen(false)
      setShortcutsSubmenuOpen(false)
      return
    }

    function handleMouseDown(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !(e.target as Element).closest('[data-panel-trigger="cutline"]') &&
        !(e.target as Element).closest('[data-cutline-submenu]')
      ) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isOpen, onClose])

  return (
    <>
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, scale: 0.96, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -4 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          top: 64,
          left: 16,
          width: 260,
          background: card.bg,
          border: card.border,
          boxShadow: card.shadow,
          borderRadius: card.radius,
          fontFamily: font.family,
          color: font.colorPrimary,
          zIndex: 30,
          overflow: 'visible',
        }}
        className={`theme-surface ${CHROME_CARD_CLASS}`}
      >
        <div ref={shortcutsAnchorRef}>
          <MenuRow
            icon={Keyboard}
            label="Shortcuts"
            right={<ChevronRight size={14} strokeWidth={2} color={font.colorMuted} />}
            onClick={() => {
              setSettingsSubmenuOpen(false)
              setShortcutsSubmenuOpen((o) => !o)
            }}
          />
        </div>
        <div ref={settingsAnchorRef}>
          <MenuRow
            icon={Settings}
            label="Settings"
            right={<ChevronRight size={14} strokeWidth={2} color={font.colorMuted} />}
            onClick={() => {
              setShortcutsSubmenuOpen(false)
              setSettingsSubmenuOpen((o) => !o)
            }}
          />
        </div>

        <div style={menuDividerStyle} />

        <MenuRow
          icon={Sparkles}
          label="What's new"
          onClick={() => onNavigate('whats-new')}
        />
      </motion.div>

      <AnimatePresence>
        {settingsSubmenuOpen && (
          <SettingsSubmenu
            anchorRef={settingsAnchorRef}
            mode={mode}
            onModeChange={onModeChange}
            onCloseMenu={onClose}
            isCanvasLocked={isCanvasLocked}
            onToggleCanvasLock={onToggleCanvasLock}
            showCanvasLock={showCanvasLock}
          />
        )}
        {shortcutsSubmenuOpen && <ShortcutsSubmenu anchorRef={shortcutsAnchorRef} />}
      </AnimatePresence>
    </>
  )
}

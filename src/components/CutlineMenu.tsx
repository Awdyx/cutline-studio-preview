import { useCallback, useEffect, useRef, useState } from 'react'
import { playSound } from '../sound/playSound'
import { motion, AnimatePresence } from 'framer-motion'
import { Keyboard, Settings, ChevronRight, Sparkles } from 'lucide-react'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import { CHROME_FROSTED_MENU_CLASS, chromeFrostedMenuStyle, font, menuDividerStyle } from '../styles/tokens'
import { phonePanelSheetStyle, phoneSubmenuSlideMotion } from '../styles/phoneChrome'
import type { ThemeMode } from '../theme/themeStore'
import CutlineAppNavSection from './CutlineAppNavSection'
import ShortcutsSubmenu from './ShortcutsSubmenu'
import SettingsSubmenu from './SettingsSubmenu'
import { MenuRow } from './MenuRow'
import { SubmenuSoundScope } from './SubmenuSoundScope'
import { useMenuOutsideDismiss } from './useMenuOutsideDismiss'
import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'
import { useUiCustomizationStore } from '../uiCustomization/uiCustomizationStore'

interface CutlineMenuProps {
  isOpen: boolean
  onClose: (opts?: { silent?: boolean }) => void
  mode: ThemeMode
  onModeChange: (mode: ThemeMode) => void
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
  isCanvasLocked,
  onToggleCanvasLock,
  showCanvasLock = true,
}: CutlineMenuProps) {
  const isPhone = useIsPhoneLayout()
  const panelRef = useRef<HTMLDivElement>(null)
  const settingsAnchorRef = useRef<HTMLDivElement>(null)
  const shortcutsAnchorRef = useRef<HTMLDivElement>(null)
  const [settingsSubmenuOpen, setSettingsSubmenuOpen] = useState(false)
  const [shortcutsSubmenuOpen, setShortcutsSubmenuOpen] = useState(false)

  const closeAllSubmenus = useCallback(() => {
    setSettingsSubmenuOpen(false)
    setShortcutsSubmenuOpen(false)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      closeAllSubmenus()
    }
  }, [isOpen, closeAllSubmenus])

  useEffect(() => {
    if (isPhone) setShortcutsSubmenuOpen(false)
  }, [isPhone])

  useEffect(() => {
    useShortcutUiStore.getState().registerCutlineMenu({ closeSubmenus: closeAllSubmenus })
    return () => useShortcutUiStore.getState().registerCutlineMenu(null)
  }, [closeAllSubmenus])

  const hasFlyoutSubmenu =
    settingsSubmenuOpen || (!isPhone && shortcutsSubmenuOpen)

  const dismissFromOutside = useCallback(
    (target: Element) => {
      // Shortcuts/settings rows swap flyouts via onClick — don't dismiss on pointerdown.
      if (target.closest('[data-cutline-submenu-anchor]')) return

      if (panelRef.current?.contains(target)) {
        closeAllSubmenus()
        return
      }

      closeAllSubmenus()
      onClose()
    },
    [closeAllSubmenus, onClose],
  )

  useMenuOutsideDismiss({
    active: isOpen,
    panelRef,
    onDismiss: dismissFromOutside,
    isInside: (target) => !!target.closest('[data-cutline-submenu]'),
    dismissInsidePanel: hasFlyoutSubmenu,
  })

  return (
    <>
      <motion.div
        ref={panelRef}
        {...(isPhone ? phoneSubmenuSlideMotion : {
          initial: { opacity: 0, scale: 0.96, y: -4 },
          animate: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0, scale: 0.96, y: -4 },
          transition: { duration: 0.18, ease: 'easeOut' },
        })}
        style={{
          ...(isPhone
            ? phonePanelSheetStyle({ display: 'flex', flexDirection: 'column' })
            : {
                position: 'fixed',
                top: 64,
                left: 16,
                width: 260,
              }),
          ...chromeFrostedMenuStyle,
          fontFamily: font.family,
          color: font.colorPrimary,
          zIndex: 30,
          overflow: 'hidden',
          paddingBottom: 12,
        }}
        className={`theme-surface ${CHROME_FROSTED_MENU_CLASS}`}
      >
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 12,
            right: 14,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.02em',
            color: font.colorMuted,
            opacity: 0.45,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          2.0
        </span>
        <SubmenuSoundScope>
        <CutlineAppNavSection onNavigate={onClose} />
        <div style={menuDividerStyle} />
          <MenuRow
          icon={Sparkles}
          label="Customize Menu"
          inset
          submenuClickSound={false}
          right={<ChevronRight size={14} strokeWidth={2} color={font.colorMuted} />}
            onClick={() => {
            closeAllSubmenus()
            onClose({ silent: true })
            window.setTimeout(() => {
              useUiCustomizationStore.getState().setEditing(true)
              playSound('menuOpen')
            }, 40)
          }}
        />
        {!isPhone && (
          <div ref={shortcutsAnchorRef} data-cutline-submenu-anchor="shortcuts">
            <MenuRow
              icon={Keyboard}
              label="Shortcuts"
              inset
              right={<ChevronRight size={14} strokeWidth={2} color={font.colorMuted} />}
              onClick={() => {
                setSettingsSubmenuOpen(false)
                setShortcutsSubmenuOpen((o) => !o)
              }}
            />
          </div>
        )}
        <div ref={settingsAnchorRef} data-cutline-submenu-anchor="settings">
          <MenuRow
            icon={Settings}
            label="Settings"
            inset
            right={<ChevronRight size={14} strokeWidth={2} color={font.colorMuted} />}
            onClick={() => {
              setShortcutsSubmenuOpen(false)
              setSettingsSubmenuOpen((o) => !o)
            }}
          />
        </div>
        </SubmenuSoundScope>
      </motion.div>

      <AnimatePresence mode="sync">
        {settingsSubmenuOpen && (
          <SettingsSubmenu
            key="settings-submenu"
            anchorRef={settingsAnchorRef}
            mode={mode}
            onModeChange={onModeChange}
            onCloseMenu={onClose}
            isCanvasLocked={isCanvasLocked}
            onToggleCanvasLock={onToggleCanvasLock}
            showCanvasLock={showCanvasLock}
            onBack={() => setSettingsSubmenuOpen(false)}
          />
        )}
        {!isPhone && shortcutsSubmenuOpen && (
          <ShortcutsSubmenu
            key="shortcuts-submenu"
            anchorRef={shortcutsAnchorRef}
            onBack={() => setShortcutsSubmenuOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

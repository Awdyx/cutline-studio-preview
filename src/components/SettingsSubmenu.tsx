import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  GraduationCap,
  Lock,
  Monitor,
  Moon,
  PencilLine,
  PencilOff,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import { CHROME_FROSTED_MENU_CLASS, chromeFrostedMenuStyle, font } from '../styles/tokens'
import type { ThemeMode } from '../theme/themeStore'
import { useEffectiveMode } from '../theme/useEffectiveMode'
import { backgroundMusic } from '../sound/backgroundMusic'
import { playSubmenuTap, playSubmenuTapThen } from '../sound/submenuSound'
import { useSoundStore } from '../sound/soundStore'
import { useCanvasEditStore } from '../canvasEdit/canvasEditStore'
import { useQuickMenuStore } from '../quickMenu/quickMenuStore'
import { useSubmenuPosition } from './useSubmenuPosition'
import MenuToggleRow, { LockToggleRow, ThemeToggleRow } from './MenuToggleRow'
import { SubmenuSoundScope } from './SubmenuSoundScope'
import PhoneStackHeader from './PhoneStackHeader'
import PhoneCenteredChromeModal from './PhoneCenteredChromeModal'

const SUBMENU_WIDTH = 260
const HINT_GAP = 12
const HINT_FONT_SIZE = 11
const HINT_DELAY_MS = 500
const VIEWPORT_PAD = 8

const SETTING_HINTS = {
  lock: 'lock items to set as background',
  sound: 'menu sounds + background music',
  canvasEdit: 'lets you add & edit items',
  quickMenu: 'choose what shows up when right-clicking the canvas',
  theme: 'click the button and see what happens',
} as const

type HintKey = keyof typeof SETTING_HINTS

interface SettingsSubmenuProps {
  anchorRef: RefObject<HTMLElement | null>
  mode: ThemeMode
  onModeChange: (mode: ThemeMode) => void
  onCloseMenu: () => void
  isCanvasLocked: boolean
  onToggleCanvasLock: () => void
  showCanvasLock?: boolean
  onBack?: () => void
}

export default function SettingsSubmenu({
  anchorRef,
  mode,
  onModeChange,
  isCanvasLocked,
  onToggleCanvasLock,
  showCanvasLock = true,
  onBack,
}: SettingsSubmenuProps) {
  const isPhone = useIsPhoneLayout()
  const [mounted, setMounted] = useState(false)
  const pos = useSubmenuPosition(anchorRef, { enabled: !isPhone })

  const soundMuted = useSoundStore((s) => s.muted)
  const musicEnabled = useSoundStore((s) => s.musicEnabled)
  const setMuted = useSoundStore((s) => s.setMuted)
  const setMusicEnabled = useSoundStore((s) => s.setMusicEnabled)
  const canvasEditEnabled = useCanvasEditStore((s) => s.enabled)
  const setCanvasEditEnabled = useCanvasEditStore((s) => s.setEnabled)
  const quickMenuMode = useQuickMenuStore((s) => s.mode)
  const setQuickMenuMode = useQuickMenuStore((s) => s.setMode)

  const effectiveMode = useEffectiveMode(mode)
  const quickMenuStudy = quickMenuMode === 'study'
  const QuickMenuRowIcon = quickMenuStudy ? GraduationCap : PencilLine
  const soundOn = !soundMuted && musicEnabled
  const ThemeRowIcon =
    mode === 'auto' ? Monitor : effectiveMode === 'dark' ? Moon : Sun

  const [activeHint, setActiveHint] = useState<HintKey | null>(null)
  const [hintY, setHintY] = useState(0)
  const [hintNonce, setHintNonce] = useState(0)
  const hintTimerRef = useRef<number | null>(null)

  function startHint(key: HintKey, rowEl: HTMLElement) {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    hintTimerRef.current = window.setTimeout(() => {
      const rect = rowEl.getBoundingClientRect()
      setHintY(rect.top + rect.height / 2)
      setHintNonce((n) => n + 1)
      setActiveHint(key)
    }, HINT_DELAY_MS)
  }

  function clearHint() {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    setActiveHint(null)
  }

  function hintSide(): 'left' | 'right' {
    if (!pos.left) return 'right'
    const rightEdge = pos.left + SUBMENU_WIDTH + HINT_GAP + 160
    return rightEdge <= window.innerWidth - VIEWPORT_PAD ? 'right' : 'left'
  }

  useLayoutEffect(() => {
    setMounted(true)
  }, [])

  function handleLockChange(locked: boolean) {
    if (locked !== isCanvasLocked) onToggleCanvasLock()
  }

  function handleSoundChange(enabled: boolean) {
    if (!enabled) {
      playSubmenuTapThen(() => {
        setMuted(true)
        setMusicEnabled(false)
      })
      return
    }
    setMuted(false)
    setMusicEnabled(true)
    void backgroundMusic.unlock()
    playSubmenuTap()
  }

  function handleThemeChange(dark: boolean) {
    onModeChange(dark ? 'dark' : 'light')
  }

  if (!mounted) return null

  function hintRow(key: HintKey, children: ReactNode) {
    if (isPhone) return <>{children}</>
    return (
      <div
        onMouseEnter={(e) => startHint(key, e.currentTarget)}
        onMouseLeave={clearHint}
      >
        {children}
      </div>
    )
  }

  const settingsBody = (
    <SubmenuSoundScope>
      {isPhone && onBack ? <PhoneStackHeader title="Settings" onBack={onBack} /> : null}
      <div
        style={{
          padding: isPhone ? '2px 0 10px' : '4px 0 8px',
          fontFamily: font.family,
        }}
      >
        {showCanvasLock && hintRow(
          'lock',
          <LockToggleRow
            icon={Lock}
            locked={isCanvasLocked}
            onChange={handleLockChange}
            disabled={isPhone && !canvasEditEnabled}
          />,
        )}
        {isPhone && hintRow(
          'canvasEdit',
          <MenuToggleRow
            icon={PencilLine}
            label="Canvas edit"
            enabled={canvasEditEnabled}
            onChange={setCanvasEditEnabled}
            trackLeftIcon={PencilOff}
            trackRightIcon={PencilLine}
          />,
        )}
        {hintRow(
          'sound',
          <MenuToggleRow
            icon={Volume2}
            label="Sound"
            enabled={soundOn}
            onChange={handleSoundChange}
            trackLeftIcon={VolumeX}
            trackRightIcon={Volume2}
            playClickSound={false}
          />,
        )}
        {hintRow(
          'quickMenu',
          <MenuToggleRow
            icon={QuickMenuRowIcon}
            label="Quick menu"
            enabled={quickMenuStudy}
            onChange={(study) => setQuickMenuMode(study ? 'study' : 'shortcut')}
            trackLeftIcon={PencilLine}
            trackRightIcon={GraduationCap}
          />,
        )}
        {hintRow(
          'theme',
          <ThemeToggleRow
            icon={ThemeRowIcon}
            dark={effectiveMode === 'dark'}
            onChange={handleThemeChange}
          />,
        )}
      </div>
    </SubmenuSoundScope>
  )

  return createPortal(
    isPhone ? (
      <PhoneCenteredChromeModal
        onDismiss={() => onBack?.()}
        cardDataAttributes={{ 'data-cutline-submenu': 'settings' }}
        maxWidth={300}
      >
        {settingsBody}
      </PhoneCenteredChromeModal>
    ) : (
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
            width: SUBMENU_WIDTH,
            ...chromeFrostedMenuStyle,
            fontFamily: font.family,
            overflow: 'hidden',
            zIndex: 40,
          }}
          className={`theme-surface ${CHROME_FROSTED_MENU_CLASS}`}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseLeave={clearHint}
        >
          {settingsBody}
        </motion.div>

        <AnimatePresence>
          {activeHint && (() => {
            const side = hintSide()
            return (
              <motion.span
                key={hintNonce}
                initial={{ opacity: 0, x: side === 'right' ? -6 : 6, scale: 0.92 }}
                animate={{ opacity: 0.5, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: side === 'right' ? -6 : 6, scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                style={{
                  position: 'fixed',
                  ...(side === 'right'
                    ? { left: pos.left + SUBMENU_WIDTH + HINT_GAP }
                    : { right: window.innerWidth - pos.left + HINT_GAP }),
                  top: hintY - 8,
                  zIndex: 41,
                  fontFamily: font.family,
                  fontSize: HINT_FONT_SIZE,
                  fontWeight: 500,
                  color: 'var(--ui-text)',
                  letterSpacing: '-0.01em',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  transformOrigin: side === 'right' ? 'left center' : 'right center',
                }}
              >
                {SETTING_HINTS[activeHint]}
              </motion.span>
            )
          })()}
        </AnimatePresence>
      </>
    ),
    document.body,
  )
}

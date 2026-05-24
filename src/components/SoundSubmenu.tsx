import { useLayoutEffect, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Music, Volume2 } from 'lucide-react'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import { CHROME_FROSTED_MENU_CLASS, chromeFrostedMenuStyle, chromeLabel, font, menuDividerStyle } from '../styles/tokens'
import { phoneSubmenuSheetStyle, phoneSubmenuSlideMotion } from '../styles/phoneChrome'
import { useSubmenuPosition } from './useSubmenuPosition'
import { backgroundMusic } from '../sound/backgroundMusic'
import { useSoundStore } from '../sound/soundStore'
import { playSubmenuHover, runSubmenuClick } from '../sound/submenuSound'
import { SubmenuSoundScope } from './SubmenuSoundScope'
import PhoneStackHeader from './PhoneStackHeader'

function ToggleRow({
  label,
  enabled,
  onChange,
}: {
  label: string
  enabled: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div
      onMouseEnter={() => playSubmenuHover()}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
      }}
    >
      <span style={{ flex: 1, fontSize: 14, color: font.colorPrimary }}>
        {chromeLabel(label)}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => {
          const next = !enabled
          runSubmenuClick(() => onChange(next))
        }}
        style={{
          width: 40,
          height: 24,
          borderRadius: 12,
          border: 'none',
          padding: 2,
          cursor: 'pointer',
          background: enabled ? 'var(--ui-accent)' : 'rgba(20, 30, 50, 0.12)',
          transition: 'background 150ms ease',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            display: 'block',
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
            transform: enabled ? 'translateX(16px)' : 'translateX(0)',
            transition: 'transform 150ms ease',
          }}
        />
      </button>
    </div>
  )
}

export default function SoundSubmenu({
  anchorRef,
  onBack,
}: {
  anchorRef: RefObject<HTMLElement | null>
  onBack?: () => void
}) {
  const isPhone = useIsPhoneLayout()
  const [mounted, setMounted] = useState(false)
  const pos = useSubmenuPosition(anchorRef, { enabled: !isPhone })
  const muted = useSoundStore((s) => s.muted)
  const musicEnabled = useSoundStore((s) => s.musicEnabled)
  const setMuted = useSoundStore((s) => s.setMuted)
  const setMusicEnabled = useSoundStore((s) => s.setMusicEnabled)

  useLayoutEffect(() => {
    setMounted(true)
  }, [])

  function handleSfxToggle(next: boolean) {
    setMuted(!next)
  }

  function handleMusicToggle(next: boolean) {
    setMusicEnabled(next)
    if (next) backgroundMusic.unlock()
  }

  if (!mounted) return null

  return createPortal(
    <motion.div
      data-cutline-submenu="sound"
      {...(isPhone ? phoneSubmenuSlideMotion : {
        initial: { opacity: 0, scale: 0.96, x: -4 },
        animate: { opacity: 1, scale: 1, x: 0 },
        exit: { opacity: 0, scale: 0.96, x: -4 },
        transition: { duration: 0.18, ease: 'easeOut' },
      })}
      style={{
        ...(isPhone
          ? phoneSubmenuSheetStyle({ zIndex: 50 })
          : {
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: 220,
            }),
        ...chromeFrostedMenuStyle,
        fontFamily: font.family,
        overflow: 'hidden',
        zIndex: 50,
      }}
      className={`theme-surface ${CHROME_FROSTED_MENU_CLASS}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <SubmenuSoundScope>
      {isPhone && onBack && <PhoneStackHeader title="Sound" onBack={onBack} />}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px 4px',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.04em',
          color: font.colorMuted,
        }}
      >
        <Volume2 size={13} strokeWidth={2} />
        Sound effects
      </div>

      <ToggleRow label="Sound effects" enabled={!muted} onChange={handleSfxToggle} />

      <div style={menuDividerStyle} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px 4px',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.04em',
          color: font.colorMuted,
        }}
      >
        <Music size={13} strokeWidth={2} />
        Background music
      </div>

      <ToggleRow
        label="Background music"
        enabled={musicEnabled}
        onChange={handleMusicToggle}
      />
      </SubmenuSoundScope>
    </motion.div>,
    document.body,
  )
}

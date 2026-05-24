import { useLayoutEffect, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import { CHROME_FROSTED_MENU_CLASS, chromeFrostedMenuStyle, chromeLabel, font } from '../styles/tokens'
import { phoneSubmenuSheetStyle, phoneSubmenuSlideMotion } from '../styles/phoneChrome'
import { submenuRowHoverProps } from '../sound/submenuSound'
import { SubmenuSoundScope } from './SubmenuSoundScope'
import { SHORTCUT_CATEGORIES, shortcutsByCategory } from '../shortcuts/shortcutDefs'
import { ShortcutKeycaps } from './ShortcutKeycaps'
import { useSubmenuPosition } from './useSubmenuPosition'
import PhoneStackHeader from './PhoneStackHeader'

export default function ShortcutsSubmenu({
  anchorRef,
  onBack,
}: {
  anchorRef: RefObject<HTMLElement | null>
  onBack?: () => void
}) {
  const isPhone = useIsPhoneLayout()
  const [mounted, setMounted] = useState(false)
  const pos = useSubmenuPosition(anchorRef, { enabled: !isPhone })
  const grouped = shortcutsByCategory()

  useLayoutEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <motion.div
      data-cutline-submenu="shortcuts"
      {...(isPhone ? phoneSubmenuSlideMotion : {
        initial: { opacity: 0, scale: 0.96, x: -4 },
        animate: { opacity: 1, scale: 1, x: 0 },
        exit: { opacity: 0, scale: 0.96, x: -4 },
        transition: { duration: 0.18, ease: 'easeOut' },
      })}
      style={{
        ...(isPhone
          ? phoneSubmenuSheetStyle({ display: 'flex', flexDirection: 'column' })
          : {
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: 300,
              maxHeight: 'min(70vh, 420px)',
            }),
        overflowY: 'auto',
        ...chromeFrostedMenuStyle,
        fontFamily: font.family,
        zIndex: 40,
        padding: isPhone ? 0 : '12px 0',
      }}
      className={`theme-surface ${CHROME_FROSTED_MENU_CLASS}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <SubmenuSoundScope>
      {isPhone && onBack && <PhoneStackHeader title="Shortcuts" onBack={onBack} />}
      <div style={isPhone ? { padding: '12px 0' } : undefined}>
      {SHORTCUT_CATEGORIES.map((category) => {
        const items = (grouped.get(category) ?? []).filter((s) => s.keys.length > 0)
        if (items.length === 0) return null

        return (
          <section key={category}>
            <h3
              style={{
                margin: '0 0 6px',
                padding: '0 14px',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.5px',
                color: font.colorMuted,
              }}
            >
              {chromeLabel(category)}
            </h3>
            <ul style={{ listStyle: 'none', margin: '0 0 12px', padding: 0 }}>
              {items.map((shortcut) => (
                <li
                  key={shortcut.id}
                  {...submenuRowHoverProps()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '7px 14px',
                    borderRadius: 8,
                    cursor: 'default',
                  }}
                >
                  <span style={{ fontSize: 13, color: font.colorPrimary }}>
                    {chromeLabel(shortcut.label)}
                  </span>
                  <ShortcutKeycaps keys={shortcut.keys} size="sm" />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      </div>
      </SubmenuSoundScope>
    </motion.div>,
    document.body,
  )
}

import { useLayoutEffect, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { CHROME_CARD_CLASS, card, chromeLabel, font } from '../styles/tokens'
import { SHORTCUT_CATEGORIES, shortcutsByCategory } from '../shortcuts/shortcutDefs'
import { ShortcutKeycaps } from './ShortcutKeycaps'
import { useSubmenuPosition } from './useSubmenuPosition'

export default function ShortcutsSubmenu({
  anchorRef,
}: {
  anchorRef: RefObject<HTMLElement | null>
}) {
  const [mounted, setMounted] = useState(false)
  const pos = useSubmenuPosition(anchorRef)
  const grouped = shortcutsByCategory()

  useLayoutEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <motion.div
      data-cutline-submenu="shortcuts"
      initial={{ opacity: 0, scale: 0.96, x: -4 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.96, x: -4 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: 300,
        maxHeight: 'min(70vh, 420px)',
        overflowY: 'auto',
        background: card.bg,
        border: card.border,
        boxShadow: card.shadow,
        borderRadius: card.radius,
        fontFamily: font.family,
        zIndex: 40,
        padding: '12px 0',
      }}
      className={`theme-surface ${CHROME_CARD_CLASS}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
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
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '7px 14px',
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
    </motion.div>,
    document.body,
  )
}

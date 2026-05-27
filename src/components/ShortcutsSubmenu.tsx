import { useLayoutEffect, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import { CHROME_FROSTED_MENU_CLASS, chromeFrostedMenuStyle, chromeLabel, font } from '../styles/tokens'
import { phoneSubmenuSheetStyle, phoneSubmenuSlideMotion } from '../styles/phoneChrome'
import { submenuRowHoverProps } from '../sound/submenuSound'
import { SubmenuSoundScope } from './SubmenuSoundScope'
import {
  SHORTCUT_CATEGORIES,
  shortcutsByCategory,
  type ShortcutDef,
} from '../shortcuts/shortcutDefs'
import { ShortcutKeycaps } from './ShortcutKeycaps'
import { useSubmenuPosition } from './useSubmenuPosition'
import PhoneStackHeader from './PhoneStackHeader'
import ChromeScrollFade from './ChromeScrollFade'

const DESKTOP_WIDTH = 800

/** Four columns — Study shortcuts fills the rightmost dead space, reducing height. */
const DESKTOP_COLUMNS: readonly (readonly string[])[] = [
  ['Edit', 'Canvas'],
  ['Navigation', 'Drawing'],
  ['Create', 'Panels'],
  ['Study shortcuts'],
]

const categoryHeadingStyle: React.CSSProperties = {
  margin: '0 0 6px',
  padding: '0 10px',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.5px',
  color: font.colorMuted,
}

const shortcutRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  padding: '7px 10px',
  borderRadius: 8,
  cursor: 'var(--cursor-default)',
}

function ShortcutRow({ shortcut }: { shortcut: ShortcutDef }) {
  const [hovered, setHovered] = useState(false)
  const reduceMotion = useReducedMotion()

  return (
    <li
      onMouseEnter={() => { setHovered(true); submenuRowHoverProps().onMouseEnter() }}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...shortcutRowStyle,
        background: hovered ? 'var(--menu-row-hover-bg)' : 'transparent',
        transition: 'background 120ms ease',
      }}
    >
      <motion.span
        animate={{ scale: hovered && !reduceMotion ? 1.045 : 1 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: 'spring', stiffness: 420, damping: 32, mass: 0.5 }
        }
        style={{
          fontSize: 12,
          color: font.colorPrimary,
          minWidth: 0,
          display: 'inline-block',
          transformOrigin: 'left center',
        }}
      >
        {chromeLabel(shortcut.label)}
      </motion.span>
      <ShortcutKeycaps keys={shortcut.keys} size="sm" />
    </li>
  )
}

function ShortcutCategorySection({
  category,
  items,
}: {
  category: string
  items: ShortcutDef[]
}) {
  if (items.length === 0) return null

  return (
    <section style={{ marginBottom: 8 }}>
      <h3 style={categoryHeadingStyle}>{chromeLabel(category)}</h3>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {items.map((shortcut) => (
          <ShortcutRow key={shortcut.id} shortcut={shortcut} />
        ))}
      </ul>
    </section>
  )
}

function ShortcutCategoryColumn({
  categories,
  grouped,
}: {
  categories: readonly string[]
  grouped: Map<string, ShortcutDef[]>
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      {categories.map((category) => {
        const items = (grouped.get(category) ?? []).filter((s) => s.keys.length > 0)
        return <ShortcutCategorySection key={category} category={category} items={items} />
      })}
    </div>
  )
}

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
              width: DESKTOP_WIDTH,
            }),
        ...(isPhone ? { overflow: 'hidden' } : {}),
        ...chromeFrostedMenuStyle,
        fontFamily: font.family,
        zIndex: 40,
        padding: isPhone ? 0 : '10px 12px',
      }}
      className={`theme-surface ${CHROME_FROSTED_MENU_CLASS}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <SubmenuSoundScope>
        {isPhone && onBack && <PhoneStackHeader title="Shortcuts" onBack={onBack} />}
        {isPhone ? (
          <ChromeScrollFade scrollStyle={{ padding: '0 10px' }} contentPadY={12}>
            {SHORTCUT_CATEGORIES.map((category) => {
              const items = (grouped.get(category) ?? []).filter((s) => s.keys.length > 0)
              return (
                <ShortcutCategorySection
                  key={category}
                  category={category}
                  items={items}
                />
              )
            })}
          </ChromeScrollFade>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr',
              gap: '4px 16px',
              alignItems: 'start',
              paddingTop: 7,
            }}
          >
            {DESKTOP_COLUMNS.map((categories) => (
              <ShortcutCategoryColumn
                key={categories.join('-')}
                categories={categories}
                grouped={grouped}
              />
            ))}
          </div>
        )}
      </SubmenuSoundScope>
    </motion.div>,
    document.body,
  )
}

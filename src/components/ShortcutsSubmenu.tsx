import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { motion, useAnimate, useReducedMotion, AnimatePresence } from 'framer-motion'
import { RotateCcw } from 'lucide-react'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import {
  CHROME_FROSTED_MENU_CLASS,
  chromeFrostedMenuStyle,
  chromeLabel,
  font,
  menuDividerStyle,
} from '../styles/tokens'
import { phoneSubmenuSheetStyle, phoneSubmenuSlideMotion } from '../styles/phoneChrome'
import { playSubmenuTap, submenuRowHoverProps } from '../sound/submenuSound'
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
import {
  combosEqual,
  comboFromEvent,
  displayToCombo,
  NON_CUSTOMIZABLE_IDS,
  useShortcutCustomStore,
} from '../shortcuts/shortcutCustomStore'
import { SHORTCUTS_BY_ID } from '../shortcuts/shortcutDefs'

const DESKTOP_WIDTH = 800

const DESKTOP_COLUMNS: readonly (readonly string[])[] = [
  ['Edit', 'Canvas'],
  ['Navigation', 'Drawing'],
  ['Create', 'Panels'],
  ['Study shortcuts'],
]

// ── Types ─────────────────────────────────────────────────────────────────────

type EditState = {
  id: string
}

// ── Inline capture area (shown inside the editing row) ────────────────────────

function CaptureArea() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
        minWidth: 48,
        justifyContent: 'flex-end',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ opacity: [0.25, 0.65, 0.25] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.18,
              ease: 'easeInOut',
            }}
            style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: 'var(--ui-accent)',
              flexShrink: 0,
            }}
          />
        ))}
      </span>
    </span>
  )
}

// ── Category heading ──────────────────────────────────────────────────────────

const categoryHeadingStyle: React.CSSProperties = {
  margin: '0 0 10px',
  padding: '0 10px',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.5px',
  color: font.colorMuted,
}

// ── Small customized dot ──────────────────────────────────────────────────────

function CustomizedDot() {
  return (
    <span
      style={{
        width: 5,
        height: 5,
        borderRadius: '50%',
        background: 'var(--ui-accent)',
        flexShrink: 0,
        opacity: 0.75,
        marginLeft: 1,
      }}
    />
  )
}

// ── Single shortcut row ───────────────────────────────────────────────────────

function ShortcutRow({
  shortcut,
  editState,
  onStartEdit,
  shakeNonce = 0,
}: {
  shortcut: ShortcutDef
  editState: EditState | null
  onStartEdit: (id: string) => void
  shakeNonce?: number
}) {
  const [hovered, setHovered] = useState(false)
  const reduceMotion = useReducedMotion()
  const overrides = useShortcutCustomStore((s) => s.overrides)
  const disabled = useShortcutCustomStore((s) => s.disabled)
  const [keycapScope, animateKeycap] = useAnimate()
  const prevNonce = useRef(0)

  // Shake the keycaps when a conflict is detected targeting this row
  useEffect(() => {
    if (shakeNonce === prevNonce.current) return
    prevNonce.current = shakeNonce
    if (!keycapScope.current || reduceMotion) return
    animateKeycap(
      keycapScope.current,
      { x: [0, -3, 3, -2, 2, 0] },
      { duration: 0.32, ease: 'easeInOut' },
    )
  }, [shakeNonce, reduceMotion])

  const isEditing = editState?.id === shortcut.id
  const isDisabled = Boolean(disabled[shortcut.id])
  const isCustomized = Boolean(overrides[shortcut.id]) || isDisabled
  const effectiveKeys = isDisabled
    ? []
    : overrides[shortcut.id]?.display ?? shortcut.keys
  const isEditable = !NON_CUSTOMIZABLE_IDS.has(shortcut.id)

  const canClick = isEditable && !isEditing

  return (
    <li
      role={isEditable ? 'button' : undefined}
      tabIndex={canClick ? 0 : undefined}
      onMouseEnter={() => {
        if (canClick) {
          setHovered(true)
          submenuRowHoverProps().onMouseEnter()
        }
      }}
      onMouseLeave={() => setHovered(false)}
      onClick={() => {
        if (!canClick) return
        playSubmenuTap()
        onStartEdit(shortcut.id)
      }}
      onKeyDown={(e) => {
        if (canClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          playSubmenuTap()
          onStartEdit(shortcut.id)
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '7px 10px',
        borderRadius: 8,
        background: isEditing
          ? 'var(--menu-row-active-bg)'
          : hovered && canClick
          ? 'var(--menu-row-hover-bg)'
          : 'transparent',
        transition: 'background 120ms ease',
        cursor: canClick ? 'pointer' : 'var(--cursor-default)',
      }}
    >
      {/* Label */}
      <motion.span
        animate={{ scale: hovered && canClick && !reduceMotion ? 1.045 : 1 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: 'spring', stiffness: 420, damping: 32, mass: 0.5 }
        }
        style={{
          fontSize: 12,
          color: font.colorPrimary,
          minWidth: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          transformOrigin: 'left center',
          flexShrink: 1,
        }}
      >
        {chromeLabel(shortcut.label)}
        {isCustomized && !isEditing && <CustomizedDot />}
      </motion.span>

      {/* Right side: keycaps or capture area */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <AnimatePresence mode="wait">
          {isEditing ? (
            <motion.span
              key="capture"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.1 }}
              style={{ display: 'inline-flex' }}
            >
              <CaptureArea />
            </motion.span>
          ) : (
            <motion.span
              key={effectiveKeys.join('+')}
              ref={keycapScope}
              initial={{ opacity: 0, scale: 0.82, y: 3 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -2 }}
              transition={{ type: 'spring', stiffness: 520, damping: 28, mass: 0.45 }}
              style={{ display: 'inline-flex' }}
            >
              <ShortcutKeycaps keys={effectiveKeys} size="sm" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </li>
  )
}

// ── Category section ──────────────────────────────────────────────────────────

function ShortcutCategorySection({
  category,
  items,
  editState,
  onStartEdit,
  shakeNonces,
}: {
  category: string
  items: ShortcutDef[]
  editState: EditState | null
  onStartEdit: (id: string) => void
  shakeNonces: Record<string, number>
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
          <ShortcutRow
            key={shortcut.id}
            shortcut={shortcut}
            editState={editState}
            onStartEdit={onStartEdit}
            shakeNonce={shakeNonces[shortcut.id] ?? 0}
          />
        ))}
      </ul>
    </section>
  )
}

// ── Column layout (desktop) ───────────────────────────────────────────────────

function ShortcutCategoryColumn({
  categories,
  grouped,
  editState,
  onStartEdit,
  shakeNonces,
}: {
  categories: readonly string[]
  grouped: Map<string, ShortcutDef[]>
  editState: EditState | null
  onStartEdit: (id: string) => void
  shakeNonces: Record<string, number>
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      {categories.map((category) => {
        const items = (grouped.get(category) ?? []).filter((s) => s.keys.length > 0)
        return (
          <ShortcutCategorySection
            key={category}
            category={category}
            items={items}
            editState={editState}
            onStartEdit={onStartEdit}
            shakeNonces={shakeNonces}
          />
        )
      })}
    </div>
  )
}

// ── Bottom action bar ─────────────────────────────────────────────────────────

function BottomBarButton({
  label,
  onClick,
  disabled,
  variant = 'ghost',
  icon: Icon,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  variant?: 'ghost' | 'primary'
  icon?: React.ElementType
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (disabled) return
        playSubmenuTap()
        onClick()
      }}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: variant === 'primary' ? '5px 12px' : '5px 9px',
        borderRadius: 7,
        border: variant === 'primary' ? 'none' : '1px solid var(--glass-border)',
        background:
          variant === 'primary'
            ? disabled
              ? 'var(--menu-row-hover-bg)'
              : 'var(--ui-accent)'
            : hovered
            ? 'var(--menu-row-hover-bg)'
            : 'transparent',
        color: disabled
          ? font.colorFaint
          : variant === 'primary'
          ? '#fff'
          : font.colorMuted,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: font.family,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.48 : 1,
        transition: 'background 100ms ease, opacity 100ms ease, color 100ms ease',
        lineHeight: 1,
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      {Icon && <Icon size={13} strokeWidth={2.5} />}
      {label}
    </button>
  )
}

function BottomBar({
  resetEnabled,
  onReset,
}: {
  resetEnabled: boolean
  onReset: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '6px 12px 9px',
        flexShrink: 0,
      }}
    >
      <BottomBarButton
        label="reset to default"
        icon={RotateCcw}
        disabled={!resetEnabled}
        onClick={onReset}
      />
    </div>
  )
}

// ── Main submenu ──────────────────────────────────────────────────────────────

export default function ShortcutsSubmenu({
  anchorRef,
  onBack,
}: {
  anchorRef: RefObject<HTMLElement | null>
  onBack?: () => void
}) {
  const isPhone = useIsPhoneLayout()
  const [mounted, setMounted] = useState(false)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [shakeNonces, setShakeNonces] = useState<Record<string, number>>({})
  const pos = useSubmenuPosition(anchorRef, { enabled: !isPhone })
  const grouped = shortcutsByCategory()

  const overrides = useShortcutCustomStore((s) => s.overrides)
  const disabled = useShortcutCustomStore((s) => s.disabled)
  const setOverride = useShortcutCustomStore((s) => s.setOverride)
  const disableShortcut = useShortcutCustomStore((s) => s.disableShortcut)
  const resetOverride = useShortcutCustomStore((s) => s.resetOverride)

  // ── Computed reset state ──────────────────────────────────────────────────

  const editingDef = editState ? SHORTCUTS_BY_ID[editState.id] : null
  const hasOverride = editState ? Boolean(overrides[editState.id]) : false
  const isEditingDisabled = editState ? Boolean(disabled[editState.id]) : false
  const defaultCombo = editingDef ? displayToCombo(editingDef.keys) : null

  const resetEnabled = hasOverride || isEditingDisabled

  // ── Key capture — auto-saves on valid combo ───────────────────────────────

  const handleReset = useCallback(() => {
    if (!editState) return
    resetOverride(editState.id)
    setEditState(null)
  }, [editState, resetOverride])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!editState) return

      e.preventDefault()
      e.stopImmediatePropagation()

      if (e.key === 'Escape') {
        disableShortcut(editState.id)
        setEditState(null)
        return
      }

      const combo = comboFromEvent(e)
      if (!combo) return

      const conflictId = useShortcutCustomStore.getState().findConflict(editState.id, combo)
      if (conflictId) {
        setShakeNonces((prev) => ({ ...prev, [conflictId]: (prev[conflictId] ?? 0) + 1 }))
        return
      }

      // If user typed the default combo, clear any override; otherwise save the new one
      const isDefault = defaultCombo && combosEqual(combo, defaultCombo)
      if (isDefault) {
        resetOverride(editState.id)
      } else {
        setOverride(editState.id, combo)
      }
      setEditState(null)
    },
    [editState, defaultCombo, setOverride, resetOverride, disableShortcut],
  )

  useEffect(() => {
    if (!editState) return
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [editState, handleKeyDown])

  // ── Mount guard ───────────────────────────────────────────────────────────

  useLayoutEffect(() => setMounted(true), [])
  if (!mounted) return null

  const startEdit = (id: string) => {
    setEditState({ id })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const shortcutList = isPhone ? (
    <ChromeScrollFade scrollStyle={{ padding: '0 10px' }} contentPadY={12}>
      {SHORTCUT_CATEGORIES.map((category) => {
        const items = (grouped.get(category) ?? []).filter((s) => s.keys.length > 0)
        return (
          <ShortcutCategorySection
            key={category}
            category={category}
            items={items}
            editState={editState}
            onStartEdit={startEdit}
            shakeNonces={shakeNonces}
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
        paddingBottom: 4,
      }}
    >
      {DESKTOP_COLUMNS.map((categories) => (
        <ShortcutCategoryColumn
          key={categories.join('-')}
          categories={categories}
          grouped={grouped}
          editState={editState}
          onStartEdit={startEdit}
          shakeNonces={shakeNonces}
        />
      ))}
    </div>
  )

  return createPortal(
    <motion.div
      data-cutline-submenu="shortcuts"
      {...(isPhone
        ? phoneSubmenuSlideMotion
        : {
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
              display: 'flex',
              flexDirection: 'column',
            }),
        ...(isPhone ? { overflow: 'hidden' } : {}),
        ...chromeFrostedMenuStyle,
        fontFamily: font.family,
        zIndex: 40,
        padding: 0,
      }}
      className={`theme-surface ${CHROME_FROSTED_MENU_CLASS}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <SubmenuSoundScope>
        {/* Header (phone only) */}
        {isPhone && onBack && <PhoneStackHeader title="Shortcuts" onBack={onBack} />}

        {/* Shortcut list */}
        <div
          style={
            isPhone
              ? { flex: 1, minHeight: 0 }
              : { padding: '10px 12px 0' }
          }
        >
          {shortcutList}
        </div>

        {/* Bottom action bar */}
        <div style={menuDividerStyle} />
        <BottomBar
          resetEnabled={resetEnabled}
          onReset={handleReset}
        />
      </SubmenuSoundScope>
    </motion.div>,
    document.body,
  )
}

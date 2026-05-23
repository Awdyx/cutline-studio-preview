import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Layers, Search, StickyNote, Type } from 'lucide-react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { focusItemOnCanvas } from '../canvas/canvasCamera'
import { useCanvasNavigationStore } from '../canvas/canvasNavigationStore'
import {
  buildCanvasSearchEntries,
  filterCanvasSearchEntries,
  type CanvasSearchEntry,
} from '../canvasSearch/canvasSearchEntries'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import {
  CHROME_CARD_CLASS,
  CHROME_GLASS_CLASS,
  CHROME_PRESERVE_CASE_CLASS,
  card,
  font,
  glass,
} from '../styles/tokens'
import { SHORTCUTS_BY_ID } from '../shortcuts/shortcutDefs'
import { modKeyLabel } from '../shortcuts/modKey'
import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'
import { playSubmenuHover, playSubmenuTap } from '../sound/submenuSound'
import { prefersCoarsePointer } from '../platform/textFocus'
import { resolveStickyColor } from '../theme/paletteGenerator'
import { useThemeStore } from '../theme/themeStore'
import { useEffectiveMode } from '../theme/useEffectiveMode'
import { ShortcutKeycaps } from './ShortcutKeycaps'

const islandBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  border: glass.border,
  boxShadow: glass.shadow,
  borderRadius: glass.radius,
  fontFamily: font.family,
  color: font.colorPrimary,
  userSelect: 'none',
}

const KIND_LABELS = {
  sticky: 'Sticky',
  text: 'Text',
  space: 'Space',
} as const

/** Inset inside the dropdown bubble so row highlights follow the outer curve. */
const DROPDOWN_INSET_PX = 6
const DROPDOWN_OUTER_RADIUS_PX = 16
const ROW_HIGHLIGHT_RADIUS_PX = DROPDOWN_OUTER_RADIUS_PX - DROPDOWN_INSET_PX
const ROW_HIGHLIGHT_RADIUS_MID_PX = 8

function rowHighlightBorderRadius(
  index: number,
  total: number,
  active: boolean,
): string | undefined {
  if (!active) return undefined
  const outer = ROW_HIGHLIGHT_RADIUS_PX
  const mid = ROW_HIGHLIGHT_RADIUS_MID_PX
  if (total === 1) return `${outer}px`
  if (index === 0) return `${outer}px ${outer}px ${mid}px ${mid}px`
  if (index === total - 1) return `${mid}px ${mid}px ${outer}px ${outer}px`
  return `${mid}px`
}

function KindIcon({ kind }: { kind: CanvasSearchEntry['kind'] }) {
  const Icon = kind === 'space' ? Layers : kind === 'text' ? Type : StickyNote
  return <Icon size={14} strokeWidth={1.8} color={font.colorMuted} />
}

interface CanvasSearchBarProps {
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
}

export default function CanvasSearchBar({ transformRef }: CanvasSearchBarProps) {
  const themeMode = useThemeStore((s) => s.mode)
  const effectiveMode = useEffectiveMode(themeMode)
  const stickyPreviewBg = resolveStickyColor(effectiveMode)
  const items = useCanvasItemsStore((s) => s.items)
  const selectItem = useCanvasItemsStore((s) => s.selectItem)

  const [value, setValue] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [searchInputReady, setSearchInputReady] = useState(!prefersCoarsePointer())
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownOpenRef = useRef(dropdownOpen)
  const lastResultActivateRef = useRef(0)
  dropdownOpenRef.current = dropdownOpen

  const entries = useMemo(() => buildCanvasSearchEntries(items), [items])
  const results = useMemo(
    () => filterCanvasSearchEntries(entries, value),
    [entries, value],
  )

  const showDropdown = dropdownOpen && value.trim().length > 0

  function selectEntry(entry: CanvasSearchEntry) {
    const now = Date.now()
    if (now - lastResultActivateRef.current < 400) return
    lastResultActivateRef.current = now

    playSubmenuTap()
    useCanvasNavigationStore.getState().suppressBackgroundSelectionClear(600)
    selectItem(entry.id, false, { allowFrozen: true })
    focusItemOnCanvas(transformRef.current, entry.item)
    setDropdownOpen(false)
    setValue('')
    inputRef.current?.blur()
  }

  useEffect(() => {
    useShortcutUiStore.getState().registerCanvasSearch({
      focus: () => {
        setSearchInputReady(true)
        playSubmenuTap()
        requestAnimationFrame(() => {
          inputRef.current?.focus()
          setDropdownOpen(true)
        })
      },
      closeDropdown: () => setDropdownOpen(false),
      isDropdownOpen: () => dropdownOpenRef.current,
      isInputFocused: () => document.activeElement === inputRef.current,
      blurInput: () => inputRef.current?.blur(),
    })
    return () => useShortcutUiStore.getState().registerCanvasSearch(null)
  }, [])

  useEffect(() => {
    setHighlightIndex(0)
  }, [value])

  useEffect(() => {
    if (!showDropdown) return
    const el = containerRef.current?.querySelector(
      `[data-search-result-index="${highlightIndex}"]`,
    ) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlightIndex, showDropdown, results.length])

  useEffect(() => {
    function dismissSearchFocus(e: PointerEvent) {
      if (containerRef.current?.contains(e.target as Node)) return
      setDropdownOpen(false)
      if (inputRef.current && document.activeElement === inputRef.current) {
        inputRef.current.blur()
      }
    }
    document.addEventListener('pointerdown', dismissSearchFocus)
    return () => document.removeEventListener('pointerdown', dismissSearchFocus)
  }, [])

  const findKeys = SHORTCUTS_BY_ID.find.keys

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: 480,
        maxWidth: '100%',
        pointerEvents: 'auto',
      }}
    >
      <div
        className={`theme-surface ${CHROME_GLASS_CLASS}`}
        style={{
          ...islandBase,
          background: dropdownOpen ? card.bg : glass.bg,
          gap: 8,
          padding: '8px 14px',
          width: '100%',
          cursor: 'text',
        }}
        onClick={() => {
          setSearchInputReady(true)
          inputRef.current?.focus()
        }}
        onPointerDown={() => setSearchInputReady(true)}
      >
        <Search
          size={15}
          color="var(--ui-text-muted)"
          strokeWidth={2}
          style={{ flexShrink: 0 }}
        />
        <input
          ref={inputRef}
          type="text"
          role="searchbox"
          aria-label="Search canvas"
          autoComplete="off"
          spellCheck={false}
          readOnly={!searchInputReady}
          data-canvas-search-input
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setDropdownOpen(true)
          }}
          onFocus={() => {
            playSubmenuTap()
            setDropdownOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && results.length > 0) {
              e.preventDefault()
              playSubmenuHover()
              setHighlightIndex((i) => (i + 1) % results.length)
              return
            }
            if (e.key === 'ArrowUp' && results.length > 0) {
              e.preventDefault()
              playSubmenuHover()
              setHighlightIndex((i) => (i - 1 + results.length) % results.length)
              return
            }
            if (e.key === 'Enter' && results[highlightIndex]) {
              e.preventDefault()
              selectEntry(results[highlightIndex])
              return
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              if (showDropdown) setDropdownOpen(false)
              else inputRef.current?.blur()
            }
          }}
          placeholder="search stickies, text, and spaces…"
          className="theme-surface"
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: 14,
            fontFamily: font.family,
            color: font.colorPrimary,
            minWidth: 0,
          }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            opacity: value ? 0 : 0.42,
            transition: 'opacity 0.15s ease',
            pointerEvents: 'none',
          }}
        >
          <ShortcutKeycaps keys={findKeys.length ? findKeys : [modKeyLabel(), 'F']} size="sm" />
        </div>
      </div>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            key="search-dropdown"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className={`theme-surface ${CHROME_CARD_CLASS}`}
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              right: 0,
              background: card.bg,
              border: card.border,
              boxShadow: card.shadow,
              borderRadius: card.radius,
              zIndex: 40,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                maxHeight: 320,
                overflowY: 'auto',
                padding: DROPDOWN_INSET_PX,
              }}
            >
            {results.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  padding: '8px 10px',
                  fontSize: 13,
                  color: font.colorMuted,
                  textAlign: 'center',
                }}
              >
                No matches on this canvas
              </p>
            ) : (
              results.map((entry, index) => {
                const active = index === highlightIndex
                return (
                  <button
                    key={entry.id}
                    type="button"
                    data-search-result-index={index}
                    onMouseEnter={() => {
                      playSubmenuHover()
                      setHighlightIndex(index)
                    }}
                    onClick={() => selectEntry(entry)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      width: '100%',
                      padding: '10px 12px',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: font.family,
                      background: active ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
                      borderRadius: rowHighlightBorderRadius(
                        index,
                        results.length,
                        active,
                      ),
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 6,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background:
                          entry.kind === 'sticky'
                            ? stickyPreviewBg
                            : entry.kind === 'space'
                              ? card.bg
                              : 'rgba(20, 30, 50, 0.06)',
                        border:
                          entry.kind === 'text'
                            ? '1px solid rgba(20, 30, 50, 0.08)'
                            : 'none',
                        overflow: 'hidden',
                      }}
                    >
                      {entry.kind === 'text' && entry.preview ? (
                        <span
                          className={CHROME_PRESERVE_CASE_CLASS}
                          style={{
                            fontSize: 8,
                            lineHeight: 1.1,
                            padding: 4,
                            color: font.colorPrimary,
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            wordBreak: 'break-word',
                          }}
                        >
                          {entry.preview}
                        </span>
                      ) : (
                        <KindIcon kind={entry.kind} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 2,
                        }}
                      >
                        <span
                          className={CHROME_PRESERVE_CASE_CLASS}
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: font.colorPrimary,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {entry.title}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                            color: font.colorFaint,
                            flexShrink: 0,
                          }}
                        >
                          {KIND_LABELS[entry.kind]}
                        </span>
                      </div>
                      <p
                        className={CHROME_PRESERVE_CASE_CLASS}
                        style={{
                          margin: 0,
                          fontSize: 12,
                          lineHeight: 1.35,
                          color: font.colorMuted,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {entry.preview}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

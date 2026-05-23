import { useEffect, useRef, useState } from 'react'
import { playSound } from '../sound/playSound'
import { AnimatePresence, motion } from 'framer-motion'
import { Eraser, Highlighter, Pen, Redo2, Trash2, Undo2 } from 'lucide-react'
import {
  CHROME_GLASS_CLASS,
  card,
  font,
  glass,
  menuDividerVerticalStyle,
} from '../styles/tokens'
import { useHistoryUiStore } from '../canvasHistory/canvasHistory'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { hasAnyAnnotations } from '../canvasLock/layer'
import { useCanvasLockStore } from '../canvasLock/canvasLockStore'
import { useStrokesStore } from '../drawing/strokesStore'
import { resolveHighlighterColor, resolvePenColor } from '../drawing/colorUtils'
import { useToolStore } from '../drawing/toolStore'
import { useThemeStore } from '../theme/themeStore'
import { useEffectiveMode } from '../theme/useEffectiveMode'
import ToolColorPopover from './ToolColorPopover'
import { SHORTCUTS_BY_ID } from '../shortcuts/shortcutDefs'
import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'
import ShortcutTooltip from './ShortcutTooltip'

const FAB_SIZE = 52
const FAB_GAP = 12
/** Left of the + FAB: 24px margin + 52px + 12px gap */
const TOOLS_FAB_RIGHT = 24 + FAB_SIZE + FAB_GAP


function ToolButton({
  active,
  onClick,
  children,
  label,
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
  label: string
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: 36,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: 10,
        cursor: 'pointer',
        background:
          active || hovered ? 'rgba(26, 34, 48, 0.08)' : 'transparent',
        transition: 'background 200ms ease',
        color: font.colorPrimary,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

function ColorDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        bottom: 4,
        right: 4,
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        border: '1px solid rgba(255,255,255,0.8)',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.08)',
      }}
    />
  )
}

export default function ToolPalette() {
  const canUndo = useHistoryUiStore((s) => s.canUndo)
  const canRedo = useHistoryUiStore((s) => s.canRedo)
  const items = useCanvasItemsStore((s) => s.items)
  const annotationStrokes = useStrokesStore((s) => s.annotationStrokes)
  const hasAnnotations = hasAnyAnnotations(items, annotationStrokes)
  const undo = useStrokesStore((s) => s.undo)
  const redo = useStrokesStore((s) => s.redo)
  const clearAllAnnotations = useCanvasLockStore((s) => s.clearAllAnnotations)

  const themeMode = useThemeStore((s) => s.mode)
  const effectiveMode = useEffectiveMode(themeMode)
  const mode = useToolStore((s) => s.mode)
  const penColor = useToolStore((s) => s.penColor)
  const highlighterColor = useToolStore((s) => s.highlighterColor)
  const penDisplayColor = resolvePenColor(penColor, effectiveMode)
  const highlighterDisplayColor = resolveHighlighterColor(
    highlighterColor,
    effectiveMode,
  )
  const setMode = useToolStore((s) => s.setMode)

  const [isOpen, setIsOpen] = useState(false)
  const [fabHovered, setFabHovered] = useState(false)
  const [colorPopover, setColorPopover] = useState<'pen' | 'highlighter' | null>(
    null,
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const isOpenRef = useRef(isOpen)
  isOpenRef.current = isOpen
  const colorPopoverRef = useRef(colorPopover)
  colorPopoverRef.current = colorPopover

  const isErase = mode === 'erase'

  function closeAll() {
    if (isOpenRef.current || colorPopoverRef.current) playSound('menuClose')
    setIsOpen(false)
    setColorPopover(null)
  }

  function openPalette() {
    playSound('menuOpen')
    setIsOpen(true)
  }

  useEffect(() => {
    useShortcutUiStore.getState().registerToolPalette({
      close: closeAll,
      isOpen: () => isOpenRef.current || colorPopoverRef.current !== null,
    })
    return () => useShortcutUiStore.getState().registerToolPalette(null)
  }, [])

  useEffect(() => {
    if (!isOpen && !colorPopover) return

    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current?.contains(e.target as Node)) return
      closeAll()
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeAll()
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, colorPopover])

  function handlePenClick() {
    if (mode === 'pen' && colorPopover === 'pen') {
      setColorPopover(null)
      return
    }
    if (mode === 'pen') {
      setColorPopover('pen')
      return
    }
    setMode('pen')
    setColorPopover(null)
  }

  function handleHighlighterClick() {
    if (mode === 'highlighter' && colorPopover === 'highlighter') {
      setColorPopover(null)
      return
    }
    if (mode === 'highlighter') {
      setColorPopover('highlighter')
      return
    }
    setMode('highlighter')
    setColorPopover(null)
  }

  function handleEraserClick() {
    setMode('erase')
    setColorPopover(null)
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        bottom: 24,
        right: TOOLS_FAB_RIGHT,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
    >
      {colorPopover && (
        <ToolColorPopover
          tool={colorPopover}
          onClose={() => setColorPopover(null)}
        />
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="tool-palette"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={`theme-surface ${CHROME_GLASS_CLASS}`}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              width: 'max-content',
              height: FAB_SIZE,
              padding: '0 8px',
              marginBottom: FAB_GAP,
              borderRadius: 999,
              background: glass.bg,
              border: glass.border,
              boxShadow: glass.shadow,
              fontFamily: font.family,
            }}
          >
            <ShortcutTooltip keys={SHORTCUTS_BY_ID.undo.keys}>
              <ToolButton
                label="Undo"
                onClick={() => {
                  if (canUndo) undo()
                }}
              >
                <Undo2
                  size={18}
                  strokeWidth={2}
                  style={{ opacity: canUndo ? 1 : 0.5 }}
                />
              </ToolButton>
            </ShortcutTooltip>
            <ShortcutTooltip keys={SHORTCUTS_BY_ID.redo.keys}>
              <ToolButton
                label="Redo"
                onClick={() => {
                  if (canRedo) redo()
                }}
              >
                <Redo2
                  size={18}
                  strokeWidth={2}
                  style={{ opacity: canRedo ? 1 : 0.5 }}
                />
              </ToolButton>
            </ShortcutTooltip>

            <div style={menuDividerVerticalStyle} />

            <ToolButton label="Pen" active={mode === 'pen'} onClick={handlePenClick}>
              <Pen size={18} strokeWidth={2} />
              <ColorDot color={penDisplayColor} />
            </ToolButton>

            <ToolButton
              label="Highlighter"
              active={mode === 'highlighter'}
              onClick={handleHighlighterClick}
            >
              <Highlighter size={18} strokeWidth={2} />
              <ColorDot color={highlighterDisplayColor} />
            </ToolButton>

            <div style={menuDividerVerticalStyle} />

            <ToolButton label="Eraser" active={isErase} onClick={handleEraserClick}>
              <Eraser size={18} strokeWidth={2} />
            </ToolButton>

            <div style={menuDividerVerticalStyle} />

            <ToolButton
              label="Clear temporary annotations"
              onClick={() => {
                if (hasAnnotations) clearAllAnnotations()
              }}
            >
              <Trash2
                size={18}
                strokeWidth={2}
                style={{ opacity: hasAnnotations ? 1 : 0.5 }}
              />
            </ToolButton>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        data-tools-fab
        aria-label={isOpen ? 'Close drawing tools' : 'Open drawing tools'}
        aria-expanded={isOpen}
        onClick={() => {
          if (isOpen) closeAll()
          else openPalette()
        }}
        onMouseEnter={() => setFabHovered(true)}
        onMouseLeave={() => setFabHovered(false)}
        animate={{ scale: fabHovered ? 1.05 : 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={`theme-surface ${CHROME_GLASS_CLASS}`}
        style={{
          width: FAB_SIZE,
          height: FAB_SIZE,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          background: isOpen ? card.bg : glass.bg,
          border: glass.border,
          boxShadow: fabHovered ? card.shadow : glass.shadow,
          transition:
            'background 200ms ease-out, box-shadow 200ms ease-out, background-color 400ms ease',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <Pen size={22} color="var(--ui-text)" strokeWidth={2} />
        <ColorDot
          color={
            mode === 'highlighter' ? highlighterDisplayColor : penDisplayColor
          }
        />
      </motion.button>
    </div>
  )
}

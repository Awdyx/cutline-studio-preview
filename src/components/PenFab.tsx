import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { playSound } from '../sound/playSound'
import { playSubmenuHover, playSubmenuTap } from '../sound/submenuSound'
import { Eraser, Highlighter, Pen, Redo2, Trash2, Undo2 } from 'lucide-react'
import {
  CHROME_CARD_CLASS,
  CHROME_GLASS_CLASS,
  CHROME_MENU_TRANSITION,
  card,
  chromeBottomRightFixed,
  font,
  glass,
  menuDividerVerticalStyle,
} from '../styles/tokens'
import { useHistoryUiStore } from '../canvasHistory/canvasHistory'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { hasStylusInput } from '../drawing/penInput'
import { hasAnyAnnotations } from '../canvasLock/layer'
import { useCanvasLockStore } from '../canvasLock/canvasLockStore'
import { useStrokesStore } from '../drawing/strokesStore'
import { useToolStore } from '../drawing/toolStore'
import ToolColorPopover from './ToolColorPopover'
import { SHORTCUTS_BY_ID } from '../shortcuts/shortcutDefs'
import { useShortcutUiStore, type ChromeMenuSoundOpts } from '../shortcuts/shortcutUiStore'
import ShortcutTooltip from './ShortcutTooltip'
import { SubmenuSoundScope, useSubmenuSoundScope } from './SubmenuSoundScope'
import { isSwapChromeMenuTarget } from './chromeMenuDismiss'
import { useCanvasMeshPauseWhile } from '../canvas/useCanvasMeshPause'

const FAB_SIZE = 52
const FAB_GAP = 12
/** Left of the + FAB: 16px margin + 52px FAB + 12px gap */
const PEN_FAB_RIGHT = 16 + FAB_SIZE + FAB_GAP
const PEN_FAB_MENU_TRANSITION_MS = 180

const TOOL_SETTINGS_PANEL_MOTION = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
  transition: CHROME_MENU_TRANSITION,
}

function ToolRowButton({
  active,
  onClick,
  children,
  label,
  submenuClickSound = true,
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
  label: string
  submenuClickSound?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const inSubmenuScope = useSubmenuSoundScope()

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        if (inSubmenuScope && submenuClickSound) playSubmenuTap()
        onClick()
      }}
      onMouseEnter={() => {
        setHovered(true)
        if (inSubmenuScope) playSubmenuHover()
      }}
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
          active || hovered ? 'var(--ui-divider-vertical)' : 'transparent',
        transition: 'background 200ms ease',
        color: font.colorPrimary,
        flexShrink: 0,
        outline: 'none',
      }}
    >
      {children}
    </button>
  )
}

function PenFabMenuContent({
  canUndo,
  canRedo,
  hasAnnotations,
  mode,
  onUndo,
  onRedo,
  onPenClick,
  onHighlighterClick,
  onEraserClick,
  onClearAnnotations,
}: {
  canUndo: boolean
  canRedo: boolean
  hasAnnotations: boolean
  mode: ReturnType<typeof useToolStore.getState>['mode']
  onUndo: () => void
  onRedo: () => void
  onPenClick: () => void
  onHighlighterClick: () => void
  onEraserClick: () => void
  onClearAnnotations: () => void
}) {
  const isErase = mode === 'erase'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '8px',
      }}
    >
      <ShortcutTooltip keys={SHORTCUTS_BY_ID.undo.keys}>
        <ToolRowButton
          label="Undo"
          submenuClickSound={false}
          onClick={() => {
            if (canUndo) onUndo()
          }}
        >
          <Undo2
            size={18}
            strokeWidth={2}
            style={{ opacity: canUndo ? 1 : 0.5 }}
          />
        </ToolRowButton>
      </ShortcutTooltip>
      <ShortcutTooltip keys={SHORTCUTS_BY_ID.redo.keys}>
        <ToolRowButton
          label="Redo"
          submenuClickSound={false}
          onClick={() => {
            if (canRedo) onRedo()
          }}
        >
          <Redo2
            size={18}
            strokeWidth={2}
            style={{ opacity: canRedo ? 1 : 0.5 }}
          />
        </ToolRowButton>
      </ShortcutTooltip>

      <div style={menuDividerVerticalStyle} />

      <ToolRowButton label="Pen" active={mode === 'pen'} onClick={onPenClick}>
        <Pen size={18} strokeWidth={2} />
      </ToolRowButton>

      <ToolRowButton
        label="Highlighter"
        active={mode === 'highlighter'}
        onClick={onHighlighterClick}
      >
        <Highlighter size={18} strokeWidth={2} />
      </ToolRowButton>

      <div style={menuDividerVerticalStyle} />

      <ToolRowButton label="Eraser" active={isErase} onClick={onEraserClick}>
        <Eraser size={18} strokeWidth={2} />
      </ToolRowButton>

      <div style={menuDividerVerticalStyle} />

      <ToolRowButton
        label="Clear temporary annotations"
        onClick={() => {
          if (hasAnnotations) onClearAnnotations()
        }}
      >
        <Trash2
          size={18}
          strokeWidth={2}
          style={{ opacity: hasAnnotations ? 1 : 0.5 }}
        />
      </ToolRowButton>
    </div>
  )
}

function cancelActiveDrawing() {
  const strokes = useStrokesStore.getState()
  strokes.cancelActiveStroke()
  strokes.cancelEraseSession()
  useCanvasItemsStore.getState().cancelActiveStickyStroke()
}

export default function PenFab() {
  const canUndo = useHistoryUiStore((s) => s.canUndo)
  const canRedo = useHistoryUiStore((s) => s.canRedo)
  const undo = useStrokesStore((s) => s.undo)
  const redo = useStrokesStore((s) => s.redo)
  const clearAllAnnotations = useCanvasLockStore((s) => s.clearAllAnnotations)

  const mode = useToolStore((s) => s.mode)
  const setMode = useToolStore((s) => s.setMode)

  const [isOpen, setIsOpen] = useState(false)
  const [menuMounted, setMenuMounted] = useState(false)
  const [menuVisible, setMenuVisible] = useState(false)
  const [fabHoverScale, setFabHoverScale] = useState(false)
  const [colorPopover, setColorPopover] = useState<'pen' | 'highlighter' | null>(
    null,
  )
  const [hasAnnotations, setHasAnnotations] = useState(false)
  const reduceMotion = useReducedMotion()

  const containerRef = useRef<HTMLDivElement>(null)
  const isOpenRef = useRef(isOpen)
  isOpenRef.current = isOpen
  const colorPopoverRef = useRef(colorPopover)
  colorPopoverRef.current = colorPopover

  useCanvasMeshPauseWhile(isOpen)

  function closeMenu(opts?: ChromeMenuSoundOpts) {
    if (
      !opts?.silent &&
      (isOpenRef.current || colorPopoverRef.current)
    ) {
      playSound('menuClose')
    }
    setFabHoverScale(false)
    setIsOpen(false)
    setColorPopover(null)
  }

  function openMenu() {
    playSound('menuOpen')
    setFabHoverScale(false)
    setIsOpen(true)
  }

  function handleFabTriggerClick() {
    if (isOpen) {
      closeMenu()
      return
    }
    useShortcutUiStore.getState().dismissPeerChromeForFab('pen')
    openMenu()
  }

  function closeColorPopover() {
    setColorPopover(null)
  }

  useLayoutEffect(() => {
    if (isOpen) {
      setMenuMounted(true)
      setMenuVisible(false)
      const id = requestAnimationFrame(() => setMenuVisible(true))
      return () => cancelAnimationFrame(id)
    }
    setMenuVisible(false)
    const timer = window.setTimeout(() => setMenuMounted(false), PEN_FAB_MENU_TRANSITION_MS)
    return () => window.clearTimeout(timer)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const refreshAnnotations = () => {
      setHasAnnotations(
        hasAnyAnnotations(
          useCanvasItemsStore.getState().items,
          useStrokesStore.getState().annotationStrokes,
        ),
      )
    }

    refreshAnnotations()
    return useCanvasItemsStore.subscribe(refreshAnnotations)
  }, [isOpen])

  useEffect(() => {
    if (isOpen) return
    cancelActiveDrawing()
  }, [isOpen])

  useEffect(() => {
    useShortcutUiStore.getState().registerToolPalette({
      close: closeMenu,
      isOpen: () => isOpenRef.current,
      closeColorPopover,
      isColorPopoverOpen: () => colorPopoverRef.current !== null,
    })
    return () => useShortcutUiStore.getState().registerToolPalette(null)
  }, [])

  useLayoutEffect(() => {
    const viewport = document.querySelector('.cutline-canvas-viewport')
    if (!(viewport instanceof HTMLElement)) return

    const desktopDraw = isOpen && !hasStylusInput()
    viewport.classList.toggle('cutline-desktop-draw', desktopDraw)

    return () => viewport.classList.remove('cutline-desktop-draw')
  }, [isOpen, colorPopover])

  useEffect(() => {
    if (!isOpen) return

    function handleMouseDown(e: MouseEvent) {
      const target = e.target
      if (!(target instanceof Node)) return
      if (containerRef.current?.contains(target)) return
      if (isSwapChromeMenuTarget(target)) return
      closeMenu()
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMenu()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  useEffect(() => {
    if (!colorPopover) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeColorPopover()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [colorPopover])

  function handlePenClick() {
    if (mode === 'pen' && colorPopover === 'pen') {
      setColorPopover(null)
      return
    }
    setMode('pen')
    setColorPopover(colorPopover !== null || mode === 'pen' ? 'pen' : null)
  }

  function handleHighlighterClick() {
    if (mode === 'highlighter' && colorPopover === 'highlighter') {
      setColorPopover(null)
      return
    }
    setMode('highlighter')
    setColorPopover(
      colorPopover !== null || mode === 'highlighter' ? 'highlighter' : null,
    )
  }

  function handleEraserClick() {
    setMode('erase')
    setColorPopover(null)
  }

  return (
    <div
      ref={containerRef}
      data-pen-fab=""
      style={{
        ...chromeBottomRightFixed,
        right: `calc(${PEN_FAB_RIGHT}px + env(safe-area-inset-right, 0px))`,
        zIndex: 21,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 12,
      }}
    >
      {menuMounted && (
        <div
          data-pen-fab-menu=""
          className={`pen-fab-menu theme-surface ${CHROME_GLASS_CLASS} ${CHROME_CARD_CLASS} plus-fab-menu-glass ${
            menuVisible ? 'pen-fab-menu--visible' : ''
          }`}
          style={{
            background: glass.bg,
            border: glass.border,
            borderRadius: card.radius,
            fontFamily: font.family,
            color: font.colorPrimary,
            pointerEvents: isOpen ? 'auto' : 'none',
          }}
        >
          <SubmenuSoundScope>
            <PenFabMenuContent
              canUndo={canUndo}
              canRedo={canRedo}
              hasAnnotations={hasAnnotations}
              mode={mode}
              onUndo={undo}
              onRedo={redo}
              onPenClick={handlePenClick}
              onHighlighterClick={handleHighlighterClick}
              onEraserClick={handleEraserClick}
              onClearAnnotations={clearAllAnnotations}
            />
            <AnimatePresence initial={false}>
              {colorPopover && (
                <motion.div
                  key="pen-fab-tool-settings"
                  className="pen-fab-tool-settings"
                  {...(reduceMotion
                    ? {
                        initial: { opacity: 0 },
                        animate: { opacity: 1 },
                        exit: { opacity: 0 },
                        transition: { duration: 0.12 },
                      }
                    : TOOL_SETTINGS_PANEL_MOTION)}
                >
                  <ToolColorPopover tool={colorPopover} />
                </motion.div>
              )}
            </AnimatePresence>
          </SubmenuSoundScope>
        </div>
      )}

      <button
        type="button"
        data-pen-fab-trigger
        aria-label={isOpen ? 'Close drawing tools' : 'Open drawing tools'}
        aria-expanded={isOpen}
        onClick={handleFabTriggerClick}
        onMouseEnter={() => setFabHoverScale(true)}
        onMouseLeave={() => setFabHoverScale(false)}
        className={`chrome-fab-trigger theme-surface ${CHROME_GLASS_CLASS} ${
          isOpen ? 'chrome-fab-trigger--pen-open' : ''
        } ${fabHoverScale ? 'chrome-fab-trigger--hover' : ''}`}
        style={{
          background: isOpen ? 'var(--card-bg)' : glass.bg,
          border: glass.border,
        }}
      >
        <Pen size={22} color="var(--ui-text)" strokeWidth={2} />
      </button>
    </div>
  )
}

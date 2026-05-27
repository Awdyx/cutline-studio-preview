import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { playSound } from '../sound/playSound'
import { playSubmenuHover, playSubmenuTap } from '../sound/submenuSound'
import { Eraser, Highlighter, Image, PenLine, Pen, Redo2, StickyNote, Trash2, Type, Undo2 } from 'lucide-react'
import { LassoIcon } from '../drawing/LassoIcon'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import ChromeTapSqueezeWrap from './ChromeTapSqueezeWrap'
import {
  CHROME_CARD_CLASS,
  CHROME_FROSTED_MENU_CLASS,
  CHROME_GLASS_CLASS,
  CHROME_MENU_TRANSITION,
  card,
  chromeBottomRightFixed,
  chromeFrostedMenuStyle,
  font,
  glass,
  menuDividerVerticalStyle,
} from '../styles/tokens'
import { useHistoryUiStore } from '../canvasHistory/canvasHistory'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { hasStylusInput } from '../drawing/penInput'
import { hasClearableLayerContent } from '../canvasLock/layer'
import { useCanvasLockStore } from '../canvasLock/canvasLockStore'
import { useCanvasEditStore } from '../canvasEdit/canvasEditStore'
import { useStrokesStore } from '../drawing/strokesStore'
import { useToolStore } from '../drawing/toolStore'
import ToolColorPopover from './ToolColorPopover'
import { useShortcutUiStore, type ChromeMenuSoundOpts } from '../shortcuts/shortcutUiStore'
import { SubmenuSoundScope, useSubmenuSoundScope } from './SubmenuSoundScope'
import { isSwapChromeMenuTarget } from './chromeMenuDismiss'
import { useCanvasMeshPauseWhile } from '../canvas/useCanvasMeshPause'
import UiPinHost from '../uiCustomization/UiPinHost'
import { useUiCustomizationStore } from '../uiCustomization/uiCustomizationStore'
import { useLassoStore, type LassoTargetType } from '../drawing/useLassoStore'

const FAB_SIZE = 52
const FAB_GAP = 12
/** Left of the + FAB: 16px margin + 52px FAB + 12px gap */
const PEN_FAB_RIGHT = 16 + FAB_SIZE + FAB_GAP
const PEN_FAB_MENU_TRANSITION_MS = 180
const PEN_FAB_HOST_TRANSITION_MS = 160

/** Dissolve shared by color-popover and lasso-panel — opacity + blur only, no movement. */
const SUBMENU_SWITCH_MOTION = {
  initial: { opacity: 0, filter: 'blur(4px)' },
  animate: { opacity: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, filter: 'blur(4px)' },
  transition: CHROME_MENU_TRANSITION,
}

/**
 * Both submenus are designed to this height (12px pad × 2 + 76px switch-host).
 * The overlay container holds this height while panels crossfade so layout never shifts.
 */
const SUBMENU_PANEL_HEIGHT = 100

function ToolRowButton({
  active,
  onClick,
  children,
  label,
  submenuClickSound = true,
  size = 36,
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
  label: string
  submenuClickSound?: boolean
  size?: number
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
        width: size,
        height: size,
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

const LASSO_TARGET_OPTIONS: { id: LassoTargetType; label: string; Icon: typeof Pen }[] = [
  { id: 'strokes', label: 'Strokes', Icon: PenLine },
  { id: 'sticky', label: 'Stickies', Icon: StickyNote },
  { id: 'text', label: 'Text', Icon: Type },
  { id: 'image', label: 'Images', Icon: Image },
]

function LassoTargetPanel({
  targets,
  onToggle,
}: {
  targets: LassoTargetType[]
  onToggle: (t: LassoTargetType) => void
}) {
  return (
    <div
      data-tool-settings=""
      style={{
        padding: '12px 12px 12px',
        fontFamily: font.family,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Reuse the switch-host class so min-height matches ToolColorPopover exactly */}
      <div
        className="tool-settings-switch-host"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
        }}
      >
        {LASSO_TARGET_OPTIONS.map(({ id, label, Icon }) => {
          const active = targets.includes(id)
          return (
            <button
              key={id}
              type="button"
              aria-label={label}
              aria-pressed={active}
              onMouseEnter={() => playSubmenuHover()}
              onClick={() => {
                if (targets.length === 1 && targets.includes(id)) {
                  const store = useShortcutUiStore.getState()
                  if (store.toast?.shortcutId === 'lasso-easter-egg') {
                    store.shakeActionToast()
                  } else {
                    store.showActionToast({
                      shortcutId: 'lasso-easter-egg',
                      label: "let's think about what we're trying to achieve",
                      keys: [],
                      holdMs: 2800,
                    })
                  }
                  return
                }
                playSubmenuTap()
                onToggle(id)
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                borderRadius: 10,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                outline: 'none',
                color: active
                  ? 'color-mix(in srgb, var(--ui-text) 72%, var(--ui-text-muted))'
                  : font.colorFaint,
                transition: 'color 150ms ease',
              }}
            >
              <Icon size={22} strokeWidth={1.75} />
              <span className="lasso-target-label">{label.toLowerCase()}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PenFabMenuContent({
  canUndo,
  canRedo,
  hasClearableContent,
  mode,
  onUndo,
  onRedo,
  onPenClick,
  onHighlighterClick,
  onEraserClick,
  onLassoClick,
  onClearLayer,
  compact = false,
}: {
  canUndo: boolean
  canRedo: boolean
  hasClearableContent: boolean
  mode: ReturnType<typeof useToolStore.getState>['mode']
  onUndo: () => void
  onRedo: () => void
  onPenClick: () => void
  onHighlighterClick: () => void
  onEraserClick: () => void
  onLassoClick: () => void
  onClearLayer: () => void
  compact?: boolean
}) {
  const isErase = mode === 'erase'
  const iconSize = compact ? 16 : 18
  const toolBtnSize = compact ? 32 : 36

  return (
    <div
      data-pen-fab-tools-row=""
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 2 : 4,
        padding: compact ? 6 : 8,
      }}
    >
      <ToolRowButton
        label="Undo"
        size={toolBtnSize}
        submenuClickSound={false}
        onClick={() => {
          if (canUndo) onUndo()
        }}
      >
        <Undo2
          size={iconSize}
          strokeWidth={2}
          style={{ opacity: canUndo ? 1 : 0.5 }}
        />
      </ToolRowButton>
      <ToolRowButton
        label="Redo"
        size={toolBtnSize}
        submenuClickSound={false}
        onClick={() => {
          if (canRedo) onRedo()
        }}
      >
        <Redo2
          size={iconSize}
          strokeWidth={2}
          style={{ opacity: canRedo ? 1 : 0.5 }}
        />
      </ToolRowButton>

      <div style={menuDividerVerticalStyle} />

      <ToolRowButton label="Pen" size={toolBtnSize} active={mode === 'pen'} onClick={onPenClick}>
        <Pen size={iconSize} strokeWidth={2} />
      </ToolRowButton>

      <ToolRowButton
        label="Highlighter"
        size={toolBtnSize}
        active={mode === 'highlighter'}
        onClick={onHighlighterClick}
      >
        <Highlighter size={iconSize} strokeWidth={2} />
      </ToolRowButton>

      <ToolRowButton label="Lasso" size={toolBtnSize} active={mode === 'lasso'} onClick={onLassoClick}>
        <LassoIcon size={iconSize} strokeWidth={2} />
      </ToolRowButton>

      <ToolRowButton label="Eraser" size={toolBtnSize} active={isErase} onClick={onEraserClick}>
        <Eraser size={iconSize} strokeWidth={2} />
      </ToolRowButton>

      <div style={menuDividerVerticalStyle} />

      <ToolRowButton
        label="Clear layer"
        size={toolBtnSize}
        onClick={() => {
          if (hasClearableContent) onClearLayer()
        }}
      >
        <Trash2
          size={iconSize}
          strokeWidth={2}
          style={{ opacity: hasClearableContent ? 1 : 0.5 }}
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
  const isPhone = useIsPhoneLayout()
  const canvasEditEnabled = useCanvasEditStore((s) => s.enabled)
  const penFabActive = !isPhone || canvasEditEnabled
  const canUndo = useHistoryUiStore((s) => s.canUndo)
  const canRedo = useHistoryUiStore((s) => s.canRedo)
  const undo = useStrokesStore((s) => s.undo)
  const redo = useStrokesStore((s) => s.redo)
  const clearLayer = useCanvasLockStore((s) => s.clearAllAnnotations)
  const isCanvasLocked = useCanvasLockStore((s) => s.isLocked)

  const mode = useToolStore((s) => s.mode)
  const setMode = useToolStore((s) => s.setMode)

  const [isOpen, setIsOpen] = useState(false)
  const [menuMounted, setMenuMounted] = useState(false)
  const [menuVisible, setMenuVisible] = useState(false)
  const [fabHoverScale, setFabHoverScale] = useState(false)
  const [colorPopover, setColorPopover] = useState<'pen' | 'highlighter' | null>(
    null,
  )
  const [lassoTargetOpen, setLassoTargetOpen] = useState(false)
  const lassoTargetTypes = useLassoStore((s) => s.targetTypes)
  const toggleLassoTarget = useLassoStore((s) => s.toggleTargetType)
  const [hasClearableContent, setHasClearableContent] = useState(false)
  const [hostMounted, setHostMounted] = useState(penFabActive)
  const [hostVisible, setHostVisible] = useState(penFabActive)
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
    setLassoTargetOpen(false)
    useShortcutUiStore.getState().setToolPaletteOpen(false)
  }

  function openMenu() {
    if (useUiCustomizationStore.getState().editing) return
    playSound('menuOpen')
    setFabHoverScale(false)
    setIsOpen(true)
    useShortcutUiStore.getState().setToolPaletteOpen(true)
  }

  function handleFabTriggerClick() {
    if (useUiCustomizationStore.getState().editing) return
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
    if (penFabActive) {
      setHostMounted(true)
      if (isPhone) {
        const id = requestAnimationFrame(() => setHostVisible(true))
        return () => cancelAnimationFrame(id)
      }
      setHostVisible(true)
      return
    }
    if (!isPhone) return
    setHostVisible(false)
    const timer = window.setTimeout(
      () => setHostMounted(false),
      PEN_FAB_HOST_TRANSITION_MS,
    )
    return () => window.clearTimeout(timer)
  }, [penFabActive, isPhone])

  useLayoutEffect(() => {
    if (isOpen) {
      setMenuMounted(true)
      setMenuVisible(false)
      const id = requestAnimationFrame(() => setMenuVisible(true))
      return () => cancelAnimationFrame(id)
    }
    // Mirror entry: hold visible one frame, then run the reverse CSS transition.
    const id = requestAnimationFrame(() => setMenuVisible(false))
    const timer = window.setTimeout(() => setMenuMounted(false), PEN_FAB_MENU_TRANSITION_MS)
    return () => {
      cancelAnimationFrame(id)
      window.clearTimeout(timer)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const refreshClearable = () => {
      const { items } = useCanvasItemsStore.getState()
      const { strokes, annotationStrokes } = useStrokesStore.getState()
      setHasClearableContent(
        hasClearableLayerContent(
          items,
          strokes,
          annotationStrokes,
          useCanvasLockStore.getState().isLocked,
        ),
      )
    }

    refreshClearable()
    const unsubItems = useCanvasItemsStore.subscribe(refreshClearable)
    const unsubStrokes = useStrokesStore.subscribe(refreshClearable)
    const unsubLock = useCanvasLockStore.subscribe(refreshClearable)
    return () => {
      unsubItems()
      unsubStrokes()
      unsubLock()
    }
  }, [isOpen, isCanvasLocked])

  useEffect(() => {
    if (isOpen) return
    cancelActiveDrawing()
  }, [isOpen])

  const openMenuRef = useRef(openMenu)
  openMenuRef.current = openMenu

  useEffect(() => {
    useShortcutUiStore.getState().registerToolPalette({
      open: () => openMenuRef.current(),
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
    const phoneDraw = isOpen && isPhone && !hasStylusInput()
    viewport.classList.toggle('cutline-desktop-draw', desktopDraw)
    viewport.classList.toggle('cutline-phone-draw', phoneDraw)

    return () => {
      viewport.classList.remove('cutline-desktop-draw')
      viewport.classList.remove('cutline-phone-draw')
    }
  }, [isOpen, isPhone, colorPopover])

  useEffect(() => {
    // Phone: keep menu open while drawing on the canvas with a finger.
    if (!isOpen || isPhone) return

    function handleMouseDown(e: MouseEvent) {
      const target = e.target
      if (!(target instanceof Node)) return
      if (containerRef.current?.contains(target)) return
      if (isSwapChromeMenuTarget(target)) return
      closeMenu()
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isOpen, isPhone])

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
    setLassoTargetOpen(false)
    if (mode === 'pen' && colorPopover === 'pen') {
      setColorPopover(null)
      return
    }
    setMode('pen')
    setColorPopover('pen')
  }

  function handleHighlighterClick() {
    setLassoTargetOpen(false)
    if (mode === 'highlighter' && colorPopover === 'highlighter') {
      setColorPopover(null)
      return
    }
    setMode('highlighter')
    setColorPopover('highlighter')
  }

  function handleEraserClick() {
    setMode('erase')
    setColorPopover(null)
    setLassoTargetOpen(false)
  }

  function handleLassoClick() {
    if (mode === 'lasso') {
      setLassoTargetOpen((v) => !v)
      return
    }
    setMode('lasso')
    setColorPopover(null)
    setLassoTargetOpen(true)
  }

  if (!hostMounted) return null

  return (
    <div
      ref={containerRef}
      data-pen-fab=""
      className={hostVisible ? 'pen-fab-host--visible' : ''}
      style={{
        ...chromeBottomRightFixed,
        right: `calc(${PEN_FAB_RIGHT}px + env(safe-area-inset-right, 0px))`,
        zIndex: 21,
        pointerEvents: 'none',
      }}
    >
      {menuMounted && (
        <div
          data-pen-fab-menu=""
          className={`pen-fab-menu ${
            menuVisible ? 'pen-fab-menu--visible' : ''
          } ${isPhone ? 'pen-fab-menu--phone' : ''}`}
          style={{
            fontFamily: font.family,
            color: font.colorPrimary,
            pointerEvents: isOpen ? (isPhone ? 'none' : 'auto') : 'none',
          }}
        >
          <SubmenuSoundScope>
            {/* Height shell: snaps instantly, opacity fades — no spatial movement */}
            <motion.div
              animate={{
                height: colorPopover || lassoTargetOpen ? SUBMENU_PANEL_HEIGHT : 0,
                opacity: colorPopover || lassoTargetOpen ? 1 : 0,
              }}
              transition={{
                // Opening: height snaps open instantly so opacity can fade into the space.
                // Closing: opacity fades out first, then height collapses after.
                height: {
                  duration: 0,
                  delay: colorPopover || lassoTargetOpen ? 0 : CHROME_MENU_TRANSITION.duration,
                },
                opacity: CHROME_MENU_TRANSITION,
              }}
              className="pen-fab-settings-shell"
              style={{ position: 'relative' }}
            >
              <AnimatePresence initial={false}>
                {colorPopover && (
                  <motion.div
                    key="pen-fab-tool-settings"
                    className={`pen-fab-tool-settings theme-surface ${CHROME_FROSTED_MENU_CLASS}`}
                    style={{ ...chromeFrostedMenuStyle, position: 'absolute', inset: 0 }}
                    {...(reduceMotion
                      ? {
                          initial: { opacity: 0 },
                          animate: { opacity: 1 },
                          exit: { opacity: 0 },
                          transition: { duration: 0.12 },
                        }
                      : SUBMENU_SWITCH_MOTION)}
                  >
                    <ToolColorPopover tool={colorPopover} />
                  </motion.div>
                )}
                {lassoTargetOpen && (
                  <motion.div
                    key="lasso-target-panel"
                    className={`pen-fab-lasso-panel theme-surface ${CHROME_FROSTED_MENU_CLASS}`}
                    style={{ ...chromeFrostedMenuStyle, position: 'absolute', inset: 0 }}
                    {...(reduceMotion
                      ? {
                          initial: { opacity: 0 },
                          animate: { opacity: 1 },
                          exit: { opacity: 0 },
                          transition: { duration: 0.12 },
                        }
                      : SUBMENU_SWITCH_MOTION)}
                  >
                    <LassoTargetPanel
                      targets={lassoTargetTypes}
                      onToggle={toggleLassoTarget}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            <div
              className={`pen-fab-toolbar theme-surface ${CHROME_FROSTED_MENU_CLASS}`}
              style={{ ...chromeFrostedMenuStyle }}
            >
              <PenFabMenuContent
                canUndo={canUndo}
                canRedo={canRedo}
                hasClearableContent={hasClearableContent}
                mode={mode}
                onUndo={undo}
                onRedo={redo}
                onPenClick={handlePenClick}
                onHighlighterClick={handleHighlighterClick}
                onEraserClick={handleEraserClick}
                onLassoClick={handleLassoClick}
                onClearLayer={clearLayer}
                compact={isPhone}
              />
            </div>
          </SubmenuSoundScope>
        </div>
      )}

      <ChromeTapSqueezeWrap>
        <button
          type="button"
          data-pen-fab-trigger
          data-ui-anchor="pen-fab"
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
            position: 'relative',
          }}
        >
          <Pen size={22} color="var(--ui-text)" strokeWidth={2} />
          <UiPinHost anchorId="pen-fab" />
        </button>
      </ChromeTapSqueezeWrap>
    </div>
  )
}

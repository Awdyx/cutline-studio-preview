import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { playSound } from '../sound/playSound'
import { playSubmenuHover, playSubmenuTap } from '../sound/submenuSound'
import { Eraser, Highlighter, Pen, Redo2, Trash2, Undo2 } from 'lucide-react'
import { LassoIcon } from '../drawing/LassoIcon'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import ChromeTapSqueezeWrap from './ChromeTapSqueezeWrap'
import {
  CHROME_FROSTED_MENU_CLASS,
  CHROME_GLASS_CLASS,
  CHROME_SURFACE_BG_TRANSITION,
  chromeBottomRightFixed,
  chromeFabMenuWrapperMotion,
  chromeFrostedMenuStyle,
  chromeGlassSurfaceBg,
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
import { isSwapChromeMenuTarget, isPenFabDrawKeepOpenTarget } from './chromeMenuDismiss'
import { useCanvasMeshPauseWhile } from '../canvas/useCanvasMeshPause'
import UiPinHost from '../uiCustomization/UiPinHost'
import { useUiCustomizationStore } from '../uiCustomization/uiCustomizationStore'
import EraserTargetSettingsPanel from './EraserTargetSettingsPanel'
import LassoTargetSettingsPanel from './LassoTargetSettingsPanel'
import { phoneFabMenuSlideMotion } from '../styles/phoneChrome'
import {
  bottomRightFabPenRightCss,
} from './bottomRightFabLayout'

const PEN_FAB_HOST_TRANSITION_MS = 160
const PEN_FAB_MENU_BRIDGE_PX = 320
/** Shared outer height for color / lasso / eraser settings panels. */
const SUBMENU_PANEL_HEIGHT = 100
/** Toolbar row + gap above the FAB — keeps the open menu inside the hit target. */
const PEN_FAB_MENU_STACK_PX = SUBMENU_PANEL_HEIGHT + 52 + 8 + 16

function penFabSettingsShellMotion(reduceMotion: boolean | null) {
  if (reduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.1 } },
      exit: { opacity: 0, transition: { duration: 0.08 } },
    }
  }
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.18, ease: 'easeOut' } },
    exit: { opacity: 0, transition: { duration: 0.14, ease: 'easeIn' } },
  }
}

function penFabSettingsContentMotion(reduceMotion: boolean | null) {
  if (reduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.1 } },
      exit: { opacity: 0, transition: { duration: 0.08 } },
    }
  }
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.14, ease: 'easeOut' } },
    exit: { opacity: 0, transition: { duration: 0.1, ease: 'easeIn' } },
  }
}

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

      <ToolRowButton
        label="Pen"
        size={toolBtnSize}
        active={mode === 'pen'}
        onClick={onPenClick}
      >
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

      <ToolRowButton
        label="Lasso"
        size={toolBtnSize}
        active={mode === 'lasso'}
        onClick={onLassoClick}
      >
        <LassoIcon size={iconSize} strokeWidth={2} />
      </ToolRowButton>

      <ToolRowButton
        label="Eraser"
        size={toolBtnSize}
        active={isErase}
        onClick={onEraserClick}
      >
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
  const [fabHoverScale, setFabHoverScale] = useState(false)
  const reduceMotion = useReducedMotion()
  const editingUi = useUiCustomizationStore((s) => s.editing)
  const fabHoverLift = fabHoverScale && !editingUi
  const [colorPopover, setColorPopover] = useState<'pen' | 'highlighter' | null>(
    null,
  )
  const [lassoTargetOpen, setLassoTargetOpen] = useState(false)
  const [eraserTargetOpen, setEraserTargetOpen] = useState(false)
  const [hasClearableContent, setHasClearableContent] = useState(false)
  const [hostMounted, setHostMounted] = useState(penFabActive)
  const [hostVisible, setHostVisible] = useState(penFabActive)

  const containerRef = useRef<HTMLDivElement>(null)
  const isOpenRef = useRef(isOpen)
  isOpenRef.current = isOpen
  const colorPopoverRef = useRef(colorPopover)
  colorPopoverRef.current = colorPopover

  useCanvasMeshPauseWhile(isOpen)

  function closeMenu(opts?: ChromeMenuSoundOpts) {
    if (
      !opts?.silent &&
      (isOpenRef.current ||
        colorPopoverRef.current ||
        lassoTargetOpen ||
        eraserTargetOpen)
    ) {
      playSound('menuClose')
    }
    setFabHoverScale(false)
    setIsOpen(false)
    setColorPopover(null)
    setLassoTargetOpen(false)
    setEraserTargetOpen(false)
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
    const { items, selectedIds } = useCanvasItemsStore.getState()
    if (selectedIds.length === 1) {
      const sel = items.find((i) => i.id === selectedIds[0])
      if (sel?.type === 'text') {
        useCanvasItemsStore.getState().clearSelection({ silent: true })
      }
    }
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

  const settingsPanelKey =
    colorPopover || lassoTargetOpen || eraserTargetOpen ? 'settings' : null
  const settingsContentKey = colorPopover
    ? `color-${colorPopover}`
    : lassoTargetOpen
      ? 'lasso'
      : 'erase'

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
      if (isPenFabDrawKeepOpenTarget(target)) return
      // Keep the menu open while toggling swatches / lasso / eraser targets.
      if (
        target instanceof Element &&
        target.closest(
          '.pen-fab-settings-shell, .pen-fab-tool-settings, .pen-fab-lasso-panel, .pen-fab-eraser-panel',
        )
      ) {
        return
      }
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
    setEraserTargetOpen(false)
    if (mode === 'pen' && colorPopover === 'pen') {
      setColorPopover(null)
      return
    }
    setMode('pen')
    setColorPopover('pen')
  }

  function handleHighlighterClick() {
    setLassoTargetOpen(false)
    setEraserTargetOpen(false)
    if (mode === 'highlighter' && colorPopover === 'highlighter') {
      setColorPopover(null)
      return
    }
    setMode('highlighter')
    setColorPopover('highlighter')
  }

  function handleEraserClick() {
    if (mode === 'erase' && eraserTargetOpen) {
      setEraserTargetOpen(false)
      return
    }
    setMode('erase')
    setColorPopover(null)
    setLassoTargetOpen(false)
    setEraserTargetOpen(true)
  }

  function handleLassoClick() {
    setEraserTargetOpen(false)
    if (mode === 'lasso') {
      setLassoTargetOpen((v) => !v)
      return
    }
    setMode('lasso')
    setColorPopover(null)
    setLassoTargetOpen(true)
  }

  if (!hostMounted) return null

  const penFabMenuMotion = isPhone
    ? phoneFabMenuSlideMotion
    : chromeFabMenuWrapperMotion(reduceMotion)

  const penFabMenuStyle: React.CSSProperties = {
    ...chromeFrostedMenuStyle,
    fontFamily: font.family,
    color: font.colorPrimary,
    transformOrigin: '100% 100%',
  }

  return (
    <div
      ref={containerRef}
      data-pen-fab=""
      className={hostVisible ? 'pen-fab-host--visible' : ''}
      style={{
        ...chromeBottomRightFixed,
        right: bottomRightFabPenRightCss(),
        zIndex: 27,
        pointerEvents: 'none',
        overflow: 'visible',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
    >
      <div
        className="pen-fab-hover-zone"
        style={{
          position: 'relative',
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
          marginLeft: isOpen && !isPhone ? -PEN_FAB_MENU_BRIDGE_PX : 0,
          paddingLeft: isOpen && !isPhone ? PEN_FAB_MENU_BRIDGE_PX : 0,
          minHeight: isOpen && !isPhone ? PEN_FAB_MENU_STACK_PX : undefined,
        }}
      >
        {isOpen && (
            <div
              data-pen-fab-menu=""
              className={`pen-fab-menu${isPhone ? ' pen-fab-menu--phone' : ''}`}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                fontFamily: font.family,
                color: font.colorPrimary,
                pointerEvents: isPhone ? 'none' : 'auto',
              }}
            >
              <AnimatePresence initial={false}>
                {settingsPanelKey && (
                  <motion.div
                    key="settings"
                    {...(colorPopover ? { 'data-pen-fab-tool-settings': '' } : {})}
                    className={[
                      'pen-fab-settings-shell',
                      'theme-surface',
                      CHROME_FROSTED_MENU_CLASS,
                      colorPopover
                        ? 'pen-fab-tool-settings'
                        : lassoTargetOpen
                          ? 'pen-fab-lasso-panel'
                          : 'pen-fab-eraser-panel',
                    ].join(' ')}
                    style={{
                      ...penFabMenuStyle,
                      position: 'relative',
                      width: '100%',
                      height: SUBMENU_PANEL_HEIGHT,
                      flexShrink: 0,
                      pointerEvents: 'auto',
                    }}
                    {...penFabSettingsShellMotion(reduceMotion)}
                  >
                    <AnimatePresence initial={false} mode="wait">
                      <motion.div
                        key={settingsContentKey}
                        {...penFabSettingsContentMotion(reduceMotion)}
                        style={{
                          height: '100%',
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {colorPopover ? (
                          <ToolColorPopover tool={colorPopover} />
                        ) : lassoTargetOpen ? (
                          <LassoTargetSettingsPanel />
                        ) : (
                          <EraserTargetSettingsPanel />
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                className={`pen-fab-toolbar theme-surface ${CHROME_FROSTED_MENU_CLASS}`}
                style={{
                  ...penFabMenuStyle,
                  transformOrigin: '100% 100%',
                  pointerEvents: isPhone ? 'none' : 'auto',
                }}
                {...penFabMenuMotion}
              >
                <SubmenuSoundScope>
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
                </SubmenuSoundScope>
              </motion.div>
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
              } ${fabHoverLift ? 'chrome-fab-trigger--hover' : ''}`}
              style={{
                transition: editingUi ? undefined : CHROME_SURFACE_BG_TRANSITION,
                background: chromeGlassSurfaceBg({
                  active: isOpen,
                  hoverLift: fabHoverLift,
                }),
                border: glass.border,
                boxShadow: glass.shadow,
                position: 'relative',
              }}
            >
              <Pen size={22} color="var(--ui-text)" strokeWidth={2} />
              <UiPinHost anchorId="pen-fab" />
            </button>
          </ChromeTapSqueezeWrap>
      </div>
    </div>
  )
}

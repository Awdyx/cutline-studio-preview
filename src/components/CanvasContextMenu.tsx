import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { LayoutGrid } from 'lucide-react'
import { playSound } from '../sound/playSound'
import { useCanvasContextMenuStore } from '../canvas/canvasContextMenuStore'
import { watchCanvasContextMenuPointerDismiss } from '../canvas/canvasContextMenuPointerDismiss'
import { useCanvasEditingAllowed } from '../canvasEdit/layer'
import {
  countSpaceWidgets,
  hasStudyHubForSubject,
  useCanvasItemsStore,
} from '../canvasItems/canvasItemsStore'
import { MAX_SPACE_WIDGETS } from '../canvasItems/types'
import { useQuickMenuStore } from '../quickMenu/quickMenuStore'
import {
  ADD_TO_CANVAS_ITEMS,
  type CanvasAddType,
} from './PlusFab'
import { STUDY_SUBJECTS, type StudySubjectId } from './study/studyHubData'
import { MenuRow } from './MenuRow'
import { SubmenuSoundScope } from './SubmenuSoundScope'
import { useMenuOutsideDismiss } from './useMenuOutsideDismiss'
import WidgetsSubmenu from './widgets/WidgetsSubmenu'
import {
  CHROME_FROSTED_MENU_CLASS,
  card,
  chromeFrostedMenuStyle,
  chromeMenuMotionY,
  font,
} from '../styles/tokens'

const MENU_WIDTH = 212
const STUDY_MENU_WIDTH = 120
const MENU_GAP = 18
/** Extra offset when the menu flips to the right of the cursor (near the left screen edge). */
const MENU_GAP_RIGHT = 32
const VIEWPORT_PAD = 8
const STUDY_HINT_TEXT = 'add to canvas first lol'
const HINT_GAP = 12
const HINT_FONT_SIZE = 11

let cachedStudyHintTextWidth: number | null = null

function measureStudyHintTextWidth(): number {
  if (cachedStudyHintTextWidth != null) return cachedStudyHintTextWidth
  if (typeof document === 'undefined') return 140

  const probe = document.createElement('span')
  probe.textContent = STUDY_HINT_TEXT
  probe.style.cssText = [
    'position:absolute',
    'visibility:hidden',
    'white-space:nowrap',
    `font:500 ${HINT_FONT_SIZE}px ${font.family}`,
    'letter-spacing:-0.01em',
  ].join(';')
  document.body.appendChild(probe)
  cachedStudyHintTextWidth = probe.getBoundingClientRect().width
  probe.remove()
  return cachedStudyHintTextWidth
}

/** Flip hint to the menu's right when the text would clip — uses text width, not menu width. */
function resolveStudyHintSide(menuLeft: number, textWidth: number): 'left' | 'right' {
  if (menuLeft - HINT_GAP - textWidth >= VIEWPORT_PAD) return 'left'
  return 'right'
}

function clampMenuPosition(
  clientX: number,
  clientY: number,
  menuWidth: number,
  menuHeight: number,
) {
  const pad = VIEWPORT_PAD
  const leftOfCursor = clientX - menuWidth - MENU_GAP
  const left =
    leftOfCursor >= pad ? leftOfCursor : clientX + MENU_GAP_RIGHT

  let top = clientY - menuHeight / 2
  top = Math.min(
    Math.max(pad, top),
    window.innerHeight - menuHeight - pad,
  )

  const maxLeft = window.innerWidth - menuWidth - pad
  return {
    left: Math.min(Math.max(pad, left), maxLeft),
    top,
  }
}

interface CanvasContextMenuProps {
  showSpaceOption: boolean
  onAddToCanvas: (type: CanvasAddType, canvasX: number, canvasY: number) => void
  onStudySubjectSelect: (
    subjectId: StudySubjectId,
    canvasX: number,
    canvasY: number,
  ) => void
}

export default function CanvasContextMenu({
  showSpaceOption,
  onAddToCanvas,
  onStudySubjectSelect,
}: CanvasContextMenuProps) {
  const quickMenuMode = useQuickMenuStore((s) => s.mode)
  const studyMenu = quickMenuMode === 'study'
  const open = useCanvasContextMenuStore((s) => s.open)
  const clientX = useCanvasContextMenuStore((s) => s.clientX)
  const clientY = useCanvasContextMenuStore((s) => s.clientY)
  const canvasX = useCanvasContextMenuStore((s) => s.canvasX)
  const canvasY = useCanvasContextMenuStore((s) => s.canvasY)
  const widgetsOpen = useCanvasContextMenuStore((s) => s.widgetsOpen)
  const close = useCanvasContextMenuStore((s) => s.close)
  const setWidgetsOpen = useCanvasContextMenuStore((s) => s.setWidgetsOpen)

  const editingAllowed = useCanvasEditingAllowed()
  const spaceWidgetCount = useCanvasItemsStore((s) => countSpaceWidgets(s.items))
  const canvasItems = useCanvasItemsStore((s) => s.items)
  const studyMenuFocusActive = useCanvasItemsStore(
    (s) => s.menuFocusReturnCamera != null,
  )
  const panelRef = useRef<HTMLDivElement>(null)
  const menuPanelRef = useRef<HTMLDivElement>(null)
  const widgetsAnchorRef = useRef<HTMLDivElement>(null)
  const [menuHeight, setMenuHeight] = useState(220)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const lastRowPointerYRef = useRef(0)
  const hintTimerRef = useRef<number | null>(null)
  const [hintNonce, setHintNonce] = useState(0)
  const [hintY, setHintY] = useState(0)
  const [hintSide, setHintSide] = useState<'left' | 'right'>('left')
  const [showHint, setShowHint] = useState(false)

  const addItems = showSpaceOption
    ? ADD_TO_CANVAS_ITEMS
    : ADD_TO_CANVAS_ITEMS.filter((item) => item.type !== 'space')
  const spacesFull = spaceWidgetCount >= MAX_SPACE_WIDGETS
  const menuWidth = studyMenu ? STUDY_MENU_WIDTH : MENU_WIDTH

  function handleClose(opts?: { silent?: boolean }) {
    if (!opts?.silent && open) playSound('menuClose')
    close()
  }

  function handleAdd(type: CanvasAddType) {
    onAddToCanvas(type, canvasX, canvasY)
    handleClose({ silent: true })
  }

  function handleStudySubject(subjectId: StudySubjectId) {
    if (
      studyMenuFocusActive &&
      !hasStudyHubForSubject(canvasItems, subjectId)
    ) {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
      setHintY(lastRowPointerYRef.current)
      setHintSide(
        resolveStudyHintSide(position.left, measureStudyHintTextWidth()),
      )
      setHintNonce((n) => n + 1)
      setShowHint(true)
      hintTimerRef.current = window.setTimeout(() => setShowHint(false), 2200)
      return
    }
    onStudySubjectSelect(subjectId, canvasX, canvasY)
    handleClose({ silent: true })
  }

  function studySubjectMissingOnCanvas(subjectId: StudySubjectId): boolean {
    return (
      studyMenuFocusActive && !hasStudyHubForSubject(canvasItems, subjectId)
    )
  }

  useLayoutEffect(() => {
    if (!open) return
    const height = panelRef.current?.offsetHeight
    if (height && height > 0) setMenuHeight(height)
    setPosition(
      clampMenuPosition(clientX, clientY, menuWidth, height ?? menuHeight),
    )
  }, [clientX, clientY, menuHeight, menuWidth, open, addItems.length, studyMenu])

  useMenuOutsideDismiss({
    active: open,
    panelRef,
    onDismiss: (target) => {
      if (target.closest('[data-canvas-context-menu-anchor]')) {
        setWidgetsOpen(false)
        return
      }
      if (panelRef.current?.contains(target)) {
        setWidgetsOpen(false)
        return
      }
      setWidgetsOpen(false)
      handleClose()
    },
    isInside: (target) => !!target.closest('[data-plus-fab-submenu]'),
    dismissInsidePanel: widgetsOpen,
  })

  useEffect(() => {
    if (!open) return

    return watchCanvasContextMenuPointerDismiss({
      openX: clientX,
      openY: clientY,
      getPanel: () => panelRef.current,
      onDismiss: () => handleClose(),
    })
  }, [open, clientX, clientY])

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (widgetsOpen) {
        setWidgetsOpen(false)
        return
      }
      handleClose()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, widgetsOpen, setWidgetsOpen])

  useEffect(() => {
    if (!open) {
      setShowHint(false)
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    }
  }, [open])

  if (!editingAllowed) return null

  return createPortal(
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="canvas-context-menu"
            ref={(node) => {
              panelRef.current = node
              menuPanelRef.current = node
            }}
            data-canvas-context-menu=""
            {...chromeMenuMotionY(4)}
            className={`theme-surface ${CHROME_FROSTED_MENU_CLASS}`}
            style={{
              position: 'fixed',
              left: position.left,
              top: position.top,
              width: menuWidth,
              zIndex: 10050,
              ...chromeFrostedMenuStyle,
              borderRadius: card.radius,
              fontFamily: font.family,
              color: font.colorPrimary,
              overflow: 'hidden',
              pointerEvents: 'auto',
            }}
          >
            <SubmenuSoundScope>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  paddingTop: 14,
                  paddingBottom: 14,
                }}
              >
                {studyMenu
                  ? (
                    <div onPointerDown={(e) => { lastRowPointerYRef.current = e.clientY }}>
                      {STUDY_SUBJECTS.map(({ id, label, icon }) => (
                        <MenuRow
                          key={id}
                          icon={icon}
                          label={label}
                          compact
                          labelHoverScale
                          noHoverFill
                          dimmed={studySubjectMissingOnCanvas(id)}
                          onClick={() => handleStudySubject(id)}
                        />
                      ))}
                    </div>
                  )
                  : (
                    <>
                      {addItems.map(({ icon, label, type }) => (
                        <MenuRow
                          key={type}
                          icon={icon}
                          label={label}
                          compact
                          labelHoverScale
                          noHoverFill
                          disabled={type === 'space' && spacesFull}
                          right={
                            type === 'space' ? (
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 500,
                                  fontVariantNumeric: 'tabular-nums',
                                  color: spacesFull ? font.colorFaint : font.colorMuted,
                                  opacity: spacesFull ? 0.55 : 0.45,
                                  flexShrink: 0,
                                }}
                              >
                                {spaceWidgetCount}/{MAX_SPACE_WIDGETS}
                              </span>
                            ) : undefined
                          }
                          onClick={() => handleAdd(type)}
                        />
                      ))}
                      <div
                        ref={widgetsAnchorRef}
                        data-canvas-context-menu-anchor="widgets"
                      >
                        <MenuRow
                          icon={LayoutGrid}
                          label="Widgets"
                          compact
                          labelHoverScale
                          noHoverFill
                          onClick={() => setWidgetsOpen(!widgetsOpen)}
                        />
                      </div>
                    </>
                  )}
              </div>
            </SubmenuSoundScope>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHint && open && (
          <motion.span
            key={hintNonce}
            initial={{
              opacity: 0,
              x: hintSide === 'left' ? 6 : -6,
              scale: 0.92,
            }}
            animate={{ opacity: 0.5, x: 0, scale: 1 }}
            exit={{
              opacity: 0,
              x: hintSide === 'left' ? 6 : -6,
              scale: 0.94,
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            style={{
              position: 'fixed',
              ...(hintSide === 'left'
                ? { right: window.innerWidth - position.left + HINT_GAP }
                : { left: position.left + menuWidth + HINT_GAP }),
              top: hintY - 8,
              zIndex: 10051,
              fontFamily: font.family,
              fontSize: HINT_FONT_SIZE,
              fontWeight: 500,
              color: 'var(--ui-text)',
              letterSpacing: '-0.01em',
              pointerEvents: 'none',
              userSelect: 'none',
              whiteSpace: 'nowrap',
              transformOrigin: hintSide === 'left' ? 'right center' : 'left center',
            }}
          >
            {STUDY_HINT_TEXT}
          </motion.span>
        )}
      </AnimatePresence>

      <AnimatePresence mode="sync">
        {open && !studyMenu && widgetsOpen && (
          <WidgetsSubmenu
            key="canvas-context-widgets-submenu"
            anchorRef={widgetsAnchorRef}
            menuPanelRef={menuPanelRef}
            onBack={() => setWidgetsOpen(false)}
          />
        )}
      </AnimatePresence>
    </>,
    document.body,
  )
}

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
import { openStudyHubEphemeralOverlay } from '../canvasItems/studyHubMenuFocus'
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
import { ComingSoonOverlay } from './ComingSoonOverlay'
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

function clampMenuPosition(
  clientX: number,
  clientY: number,
  menuWidth: number,
  menuHeight: number,
) {
  const pad = VIEWPORT_PAD
  const leftOfCursor = clientX - menuWidth - MENU_GAP
  const rightOfCursor = clientX + MENU_GAP_RIGHT

  // On touch devices (iPad) the preferred side follows which half of the screen
  // was tapped — right of the tap on the left half (thumb-friendly), left of
  // the tap on the right half.  Desktop always keeps the original left-side
  // preference.  Both cases fall back to the opposite side when the preferred
  // placement would overflow the viewport — preserving the existing edge-avoidance.
  const isTouch = window.matchMedia('(pointer: coarse)').matches
  const tapOnLeftHalf = clientX < window.innerWidth / 2
  let left: number
  if (isTouch && tapOnLeftHalf) {
    const rightFits = rightOfCursor + menuWidth <= window.innerWidth - pad
    left = rightFits ? rightOfCursor : leftOfCursor
  } else {
    left = leftOfCursor >= pad ? leftOfCursor : rightOfCursor
  }

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
  const studyHubMenuFocusActive = useCanvasItemsStore(
    (s) =>
      s.menuFocusReturnCamera != null ||
      s.menuFocusEphemeralSubjectId != null,
  )
  const studyMenu = quickMenuMode === 'study' || studyHubMenuFocusActive
  const open = useCanvasContextMenuStore((s) => s.open)
  const clientX = useCanvasContextMenuStore((s) => s.clientX)
  const clientY = useCanvasContextMenuStore((s) => s.clientY)
  const canvasX = useCanvasContextMenuStore((s) => s.canvasX)
  const canvasY = useCanvasContextMenuStore((s) => s.canvasY)
  const close = useCanvasContextMenuStore((s) => s.close)
  const [widgetsComingSoon, setWidgetsComingSoon] = useState(false)

  const editingAllowed = useCanvasEditingAllowed()
  const spaceWidgetCount = useCanvasItemsStore((s) => countSpaceWidgets(s.items))
  const canvasItems = useCanvasItemsStore((s) => s.items)
  const panelRef = useRef<HTMLDivElement>(null)
  const menuPanelRef = useRef<HTMLDivElement>(null)
  const [menuHeight, setMenuHeight] = useState(220)
  const [position, setPosition] = useState({ left: 0, top: 0 })

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
      studyHubMenuFocusActive &&
      !hasStudyHubForSubject(canvasItems, subjectId)
    ) {
      openStudyHubEphemeralOverlay(subjectId)
      handleClose({ silent: true })
      return
    }
    onStudySubjectSelect(subjectId, canvasX, canvasY)
    handleClose({ silent: true })
  }

  function studySubjectMissingOnCanvas(subjectId: StudySubjectId): boolean {
    return (
      studyHubMenuFocusActive && !hasStudyHubForSubject(canvasItems, subjectId)
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
      if (panelRef.current?.contains(target)) return
      handleClose()
    },
    isInside: () => false,
    dismissInsidePanel: false,
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
      handleClose()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
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
                    <>
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
                    </>
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
                      <MenuRow
                        icon={LayoutGrid}
                        label="Widgets"
                        compact
                        labelHoverScale
                        noHoverFill
                        onClick={() => { handleClose({ silent: true }); setWidgetsComingSoon(true) }}
                      />
                    </>
                  )}
              </div>
            </SubmenuSoundScope>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {widgetsComingSoon && (
          <ComingSoonOverlay key="widgets-coming-soon" onDismiss={() => setWidgetsComingSoon(false)} />
        )}
      </AnimatePresence>
    </>,
    document.body,
  )
}

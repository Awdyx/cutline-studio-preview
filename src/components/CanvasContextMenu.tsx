import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { LayoutGrid } from 'lucide-react'
import { playSound } from '../sound/playSound'
import { useCanvasContextMenuStore } from '../canvas/canvasContextMenuStore'
import { watchCanvasContextMenuPointerDismiss } from '../canvas/canvasContextMenuPointerDismiss'
import { useCanvasEditingAllowed } from '../canvasEdit/layer'
import { countSpaceWidgets, useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { MAX_SPACE_WIDGETS } from '../canvasItems/types'
import {
  ADD_TO_CANVAS_ITEMS,
  type CanvasAddType,
} from './PlusFab'
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
}

export default function CanvasContextMenu({
  showSpaceOption,
  onAddToCanvas,
}: CanvasContextMenuProps) {
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
  const panelRef = useRef<HTMLDivElement>(null)
  const menuPanelRef = useRef<HTMLDivElement>(null)
  const widgetsAnchorRef = useRef<HTMLDivElement>(null)
  const [menuHeight, setMenuHeight] = useState(220)
  const [position, setPosition] = useState({ left: 0, top: 0 })

  const addItems = showSpaceOption
    ? ADD_TO_CANVAS_ITEMS
    : ADD_TO_CANVAS_ITEMS.filter((item) => item.type !== 'space')
  const spacesFull = spaceWidgetCount >= MAX_SPACE_WIDGETS

  function handleClose(opts?: { silent?: boolean }) {
    if (!opts?.silent && open) playSound('menuClose')
    close()
  }

  function handleAdd(type: CanvasAddType) {
    onAddToCanvas(type, canvasX, canvasY)
    handleClose({ silent: true })
  }

  useLayoutEffect(() => {
    if (!open) return
    const height = panelRef.current?.offsetHeight
    if (height && height > 0) setMenuHeight(height)
    setPosition(
      clampMenuPosition(clientX, clientY, MENU_WIDTH, height ?? menuHeight),
    )
  }, [clientX, clientY, menuHeight, open, addItems.length])

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
              width: MENU_WIDTH,
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
                {addItems.map(({ icon, label, type }) => (
                  <MenuRow
                    key={type}
                    icon={icon}
                    label={label}
                    compact
                    labelHoverScale
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
                    onClick={() => setWidgetsOpen(!widgetsOpen)}
                  />
                </div>
              </div>
            </SubmenuSoundScope>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="sync">
        {open && widgetsOpen && (
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

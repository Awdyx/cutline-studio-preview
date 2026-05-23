import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDownToLine, ArrowUpToLine, Trash2 } from 'lucide-react'
import { CHROME_GLASS_CLASS, chromeLabel, glass, font, menuDividerStyle } from '../styles/tokens'
import { useCanvasItemsStore } from './canvasItemsStore'
import TextAlignmentMenuSection from './TextAlignmentMenuSection'
import {
  GRAB_HANDLE_OFFSET_X,
  GRAB_HANDLE_TOP,
  HANDLE_HIT_SIZE,
  Z_MENU_GAP,
} from './grabZone'

function MenuRow({
  icon: Icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '10px 14px',
        border: 'none',
        background: 'transparent',
        color: destructive ? '#c44e4e' : font.colorPrimary,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: font.family,
        cursor: 'pointer',
        borderRadius: 10,
        textAlign: 'left',
        whiteSpace: 'nowrap',
      }}
      className={
        destructive
          ? 'canvas-item-z-menu-row canvas-item-z-menu-row--destructive'
          : 'canvas-item-z-menu-row'
      }
    >
      <Icon
        size={16}
        strokeWidth={2}
        style={{
          color: destructive ? '#c44e4e' : font.colorMuted,
          flexShrink: 0,
        }}
      />
      {chromeLabel(label)}
    </button>
  )
}

export default function CanvasItemZOrderMenu() {
  const zMenu = useCanvasItemsStore((s) => s.zMenu)
  const closeZMenu = useCanvasItemsStore((s) => s.closeZMenu)
  const bringToFront = useCanvasItemsStore((s) => s.bringToFront)
  const sendToBack = useCanvasItemsStore((s) => s.sendToBack)
  const deleteItem = useCanvasItemsStore((s) => s.deleteItem)
  const menuItem = useCanvasItemsStore((s) =>
    zMenu ? s.items.find((item) => item.id === zMenu.itemId) : undefined,
  )
  const isSpace = menuItem?.type === 'space'
  const showTextAlign =
    menuItem?.type === 'sticky' || menuItem?.type === 'text'

  useEffect(() => {
    if (!zMenu) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeZMenu()
    }

    function onPointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement
      if (target.closest('[data-canvas-item-z-menu]')) return
      if (target.closest('.canvas-item-drag-handle')) return
      if (target.closest('.canvas-item-resize-handle')) return
      closeZMenu()
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown, { capture: true })
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown, { capture: true })
    }
  }, [zMenu, closeZMenu])

  const anchorX = zMenu?.anchorX ?? 0
  const anchorY = zMenu?.anchorY ?? 0
  const itemId = zMenu?.itemId
  const menuAnchorLeft = anchorX - GRAB_HANDLE_OFFSET_X - Z_MENU_GAP

  return (
    <AnimatePresence>
      {zMenu && itemId && (
        <motion.div
          key={itemId}
          data-canvas-item-z-menu
          className={CHROME_GLASS_CLASS}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 520, damping: 34, mass: 0.7 }}
          style={{
            position: 'fixed',
            left: menuAnchorLeft,
            top: anchorY - (GRAB_HANDLE_TOP + HANDLE_HIT_SIZE / 2),
            translate: '-100% 0',
            zIndex: 30,
            minWidth: 168,
            padding: 4,
            borderRadius: 14,
            background: glass.bg,
            border: glass.border,
            boxShadow: glass.shadow,
            pointerEvents: 'auto',
            transformOrigin: 'center right',
          }}
        >
          {showTextAlign && menuItem && (
            <TextAlignmentMenuSection
              itemId={menuItem.id}
              alignment={menuItem.textAlign}
            />
          )}
          {!isSpace && (
            <>
              <MenuRow
                icon={ArrowUpToLine}
                label="Bring to front"
                onClick={() => {
                  bringToFront(itemId)
                  closeZMenu()
                }}
              />
              <MenuRow
                icon={ArrowDownToLine}
                label="Send to back"
                onClick={() => {
                  sendToBack(itemId)
                  closeZMenu()
                }}
              />
              <div style={menuDividerStyle} />
            </>
          )}
          <MenuRow
            icon={Trash2}
            label="Delete"
            destructive
            onClick={() => {
              deleteItem(itemId)
              closeZMenu()
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

import { useCallback, useEffect, useRef } from 'react'
import { startHoldRepeat, type HoldRepeatHandle } from '../hooks/holdRepeat'
import { AnimatePresence, motion } from 'framer-motion'
import { Minus, Plus } from 'lucide-react'
import { playSubmenuHover, runSubmenuClick } from '../sound/submenuSound'
import { font } from '../styles/tokens'
import { useCanvasEditingAllowed } from '../canvasEdit/layer'
import { useCanvasItemDragStore } from './canvasItemDragStore'
import { getSoleSelectedItemId } from './canvasItemZMenuLayout'
import { useCanvasItemsStore } from './canvasItemsStore'
import { useLassoStore } from '../drawing/useLassoStore'
import type { StickyCanvasItem, TextCanvasItem } from './types'
import {
  changeEditorFontSize,
  STICKY_DEFAULT_FONT_SIZE,
  TEXT_ITEM_DEFAULT_FONT_SIZE,
} from './textEditorFontSize'
import { useTextFontSizeMenuLayout } from './textFontSizeMenuLayout'

function readActiveEditor(itemId: string): {
  editor: HTMLElement
  defaultPx: number
} | null {
  const root = document.querySelector(`[data-item-id="${itemId}"]`)
  if (!root) return null
  const itemType = root.getAttribute('data-canvas-item')
  const editor = root.querySelector<HTMLElement>('.canvas-text-editor')
  if (!editor) return null
  const defaultPx =
    itemType === 'sticky' ? STICKY_DEFAULT_FONT_SIZE : TEXT_ITEM_DEFAULT_FONT_SIZE
  return { editor, defaultPx }
}

function FontSizeButton({
  label,
  onStep,
  children,
}: {
  label: string
  onStep: () => void
  children: React.ReactNode
}) {
  const holdRef = useRef<HoldRepeatHandle | null>(null)
  const pointerHeldRef = useRef(false)

  useEffect(() => () => holdRef.current?.stop(), [])

  const stopHold = () => {
    pointerHeldRef.current = false
    holdRef.current?.stop()
    holdRef.current = null
  }

  const beginHold = () => {
    stopHold()
    pointerHeldRef.current = true
    runSubmenuClick(onStep)
    holdRef.current = startHoldRepeat(onStep, {
      whileActive: () => pointerHeldRef.current,
    })
  }

  const endPointer = (e: React.PointerEvent<HTMLButtonElement>) => {
    stopHold()
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  return (
    <button
      type="button"
      aria-label={label}
      onMouseEnter={() => playSubmenuHover()}
      onClick={(e) => {
        // Keyboard activation only — pointer path handles mouse/touch.
        if (e.detail !== 0) return
        runSubmenuClick(onStep)
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        beginHold()
      }}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onLostPointerCapture={stopHold}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
        padding: 0,
        border: 'none',
        borderRadius: 8,
        background: 'transparent',
        color: font.colorMuted,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

export default function TextFontSizeFloatingMenu() {
  const menuRef = useRef<HTMLDivElement>(null)
  const selectedIds = useCanvasItemsStore((s) => s.selectedIds)
  const activeDragItemId = useCanvasItemDragStore((s) => s.activeItemId)
  const zMenuSuppressedItemId = useCanvasItemsStore((s) => s.zMenuSuppressedItemId)
  const hasLassoItemSelection = useLassoStore((s) => s.selectedItemIds.length > 0)
  const editingAllowed = useCanvasEditingAllowed()

  const itemId = getSoleSelectedItemId(selectedIds)
  const menuItem = useCanvasItemsStore((s) =>
    itemId
      ? (s.items.find((item) => item.id === itemId) as
          | TextCanvasItem
          | StickyCanvasItem
          | undefined)
      : undefined,
  )
  const isTextItem = menuItem?.type === 'text' || menuItem?.type === 'sticky'

  const showMenu =
    itemId != null &&
    isTextItem &&
    activeDragItemId !== itemId &&
    editingAllowed &&
    itemId !== zMenuSuppressedItemId &&
    !hasLassoItemSelection

  const menuLayout = useTextFontSizeMenuLayout(menuRef, itemId, showMenu)

  const applyDirection = useCallback(
    (direction: 'increase' | 'decrease') => {
      if (!itemId) return
      const ctx = readActiveEditor(itemId)
      if (!ctx) return
      if (changeEditorFontSize(ctx.editor, direction, ctx.defaultPx)) {
        ctx.editor.dispatchEvent(new Event('input', { bubbles: true }))
      }
    },
    [itemId],
  )

  return (
    <AnimatePresence>
      {showMenu && itemId && (
        <motion.div
          ref={menuRef}
          key={`font-size-${itemId}`}
          data-text-font-size-menu
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 520, damping: 34, mass: 0.7 }}
          style={{
            position: 'fixed',
            left: menuLayout.left,
            top: menuLayout.top,
            zIndex: 31,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            padding: '2px 4px',
            borderRadius: 10,
            background: 'color-mix(in srgb, var(--chrome-glass-bg) 72%, transparent)',
            pointerEvents: 'auto',
            transformOrigin: 'bottom left',
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.preventDefault()}
        >
          <FontSizeButton
            label="Decrease font size"
            onStep={() => applyDirection('decrease')}
          >
            <Minus size={14} strokeWidth={2} />
          </FontSizeButton>
          <FontSizeButton
            label="Increase font size"
            onStep={() => applyDirection('increase')}
          >
            <Plus size={14} strokeWidth={2} />
          </FontSizeButton>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

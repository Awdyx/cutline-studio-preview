import { useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDownToLine,
  ArrowUpToLine,
  CornerUpLeft,
  Frame,
  Proportions,
  Trash2,
} from 'lucide-react'
import { MenuRow } from '../components/MenuRow'
import { SubmenuSoundScope } from '../components/SubmenuSoundScope'
import { mediaItemHasImportDimensions } from '../media/mediaImportDimensions'
import { PHONE_Z_ORDER_MENU_SCALE } from '../styles/phoneChrome'
import { CHROME_GLASS_CLASS, glass, menuDividerStyle } from '../styles/tokens'
import { useCanvasEditingAllowed } from '../canvasEdit/layer'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import {
  getSoleSelectedItemId,
  useCanvasItemZMenuLayout,
} from './canvasItemZMenuLayout'
import { useCanvasItemDragStore } from './canvasItemDragStore'
import { useCanvasItemsStore } from './canvasItemsStore'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import TextAlignmentMenuSection from './TextAlignmentMenuSection'
import { resolveItemTextAlignment } from './textAlignment'

export default function CanvasItemZOrderMenu() {
  const isPhone = useIsPhoneLayout()
  const menuRef = useRef<HTMLDivElement>(null)
  const selectedIds = useCanvasItemsStore((s) => s.selectedIds)
  const activeDragItemId = useCanvasItemDragStore((s) => s.activeItemId)
  const bringToFront = useCanvasItemsStore((s) => s.bringToFront)
  const sendToBack = useCanvasItemsStore((s) => s.sendToBack)
  const restoreImportSizing = useCanvasItemsStore((s) => s.restoreImportSizing)
  const restoreSizingAnimatingId = useCanvasItemsStore(
    (s) => s.restoreSizingAnimatingId,
  )
  const deleteItem = useCanvasItemsStore((s) => s.deleteItem)
  const sendItemToMainCanvas = useCanvasItemsStore((s) => s.sendItemToMainCanvas)
  const previewAdjustSpaceId = useCanvasItemsStore((s) => s.previewAdjustSpaceId)
  const setPreviewAdjustSpace = useCanvasItemsStore((s) => s.setPreviewAdjustSpace)

  const itemId = getSoleSelectedItemId(selectedIds)
  const zMenuSuppressedItemId = useCanvasItemsStore((s) => s.zMenuSuppressedItemId)
  const editingAllowed = useCanvasEditingAllowed()
  const showMenu =
    itemId != null &&
    activeDragItemId !== itemId &&
    editingAllowed &&
    itemId !== zMenuSuppressedItemId

  const menuItem = useCanvasItemsStore((s) =>
    itemId ? s.items.find((item) => item.id === itemId) : undefined,
  )
  const isMediaItem = menuItem?.type === 'image' || menuItem?.type === 'video'
  const showRestoreImportSizing =
    isMediaItem &&
    menuItem != null &&
    mediaItemHasImportDimensions(menuItem)
  const restoreImportSizingDisabled =
    !showRestoreImportSizing ||
    restoreSizingAnimatingId === itemId ||
    (menuItem != null &&
      menuItem.width === menuItem.importWidth &&
      menuItem.height === menuItem.importHeight)
  const showTextAlign =
    menuItem?.type === 'sticky' ||
    menuItem?.type === 'text' ||
    menuItem?.type === 'space'

  const spaceMeta = useCanvasWorkspaceStore((s) =>
    menuItem?.type === 'space' && itemId ? s.spaces[itemId] : undefined,
  )
  const spaceHasPreviewContent =
    !!spaceMeta &&
    (spaceMeta.items.length > 0 ||
      spaceMeta.strokes.length > 0 ||
      spaceMeta.annotationStrokes.length > 0)
  const isPreviewAdjusting = previewAdjustSpaceId === itemId
  const isInsideSpace = useCanvasWorkspaceStore((s) => s.activeCanvasId !== 'main')
  const canSendBackToMain =
    isInsideSpace &&
    menuItem != null &&
    menuItem.type !== 'space' &&
    menuItem.mainCanvasOrigin != null

  const menuLayout = useCanvasItemZMenuLayout(menuRef, itemId, showMenu)
  const menuScale = isPhone ? PHONE_Z_ORDER_MENU_SCALE : 1

  return (
    <AnimatePresence>
      {showMenu && itemId && (
        <motion.div
          ref={menuRef}
          key={itemId}
          data-canvas-item-z-menu
          className={CHROME_GLASS_CLASS}
          initial={{ opacity: 0, scale: 0.94 * menuScale }}
          animate={{ opacity: 1, scale: menuScale }}
          exit={{ opacity: 0, scale: 0.96 * menuScale }}
          transition={{ type: 'spring', stiffness: 520, damping: 34, mass: 0.7 }}
          style={{
            position: 'fixed',
            left: menuLayout.left,
            top: menuLayout.top,
            translate: `${menuLayout.translateX} 0`,
            zIndex: 30,
            minWidth: 168,
            padding: 4,
            borderRadius: 14,
            background: glass.bg,
            border: glass.border,
            boxShadow: glass.shadow,
            pointerEvents: 'auto',
            transformOrigin: menuLayout.transformOrigin,
            overflow: 'hidden',
          }}
        >
          <SubmenuSoundScope>
            {showTextAlign && menuItem && (
              <TextAlignmentMenuSection
                itemId={menuItem.id}
                alignment={resolveItemTextAlignment(menuItem)}
                showVertical={menuItem.type !== 'space'}
              />
            )}
            {menuItem?.type === 'space' && (
              <MenuRow
                icon={Frame}
                label="Adjust preview"
                active={isPreviewAdjusting}
                disabled={!spaceHasPreviewContent}
                onClick={() =>
                  setPreviewAdjustSpace(isPreviewAdjusting ? null : itemId)
                }
              />
            )}
            {canSendBackToMain && (
              <MenuRow
                icon={CornerUpLeft}
                label="Send back to main canvas"
                onClick={() => sendItemToMainCanvas(itemId)}
              />
            )}
            {showRestoreImportSizing && (
              <MenuRow
                icon={Proportions}
                label="Restore original sizing"
                disabled={restoreImportSizingDisabled}
                onClick={() => restoreImportSizing(itemId)}
              />
            )}
            <MenuRow
              icon={ArrowUpToLine}
              label="Bring to front"
              submenuClickSound={false}
              onClick={() => bringToFront(itemId)}
            />
            <MenuRow
              icon={ArrowDownToLine}
              label="Send to back"
              submenuClickSound={false}
              onClick={() => sendToBack(itemId)}
            />
            <div style={menuDividerStyle} />
            <MenuRow
              icon={Trash2}
              label="Delete"
              destructive
              submenuClickSound={false}
              onClick={() => deleteItem(itemId)}
            />
          </SubmenuSoundScope>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

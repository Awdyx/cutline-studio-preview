import type { CanvasItemType } from '../canvasItems/types'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { playSound } from '../sound/playSound'
import { captureLiftFromDom } from './captureCanvasItemSnapshot'
import { useCanvasCustomizeStore } from './canvasCustomizeStore'
import { flushCanvasItemRichTextFromDom } from './flushCanvasItemRichText'

export function isCanvasItemUiCustomizableType(
  type: CanvasItemType,
): boolean {
  return (
    type === 'sticky' ||
    type === 'image' ||
    type === 'space' ||
    type === 'study_hub'
  )
}

/** Open customize: snapshot on-canvas shell, then start session with frozen lift. */
export function enterCanvasItemCustomization(itemId: string): void {
  const item = useCanvasItemsStore.getState().items.find((i) => i.id === itemId)
  if (!item) return

  flushCanvasItemRichTextFromDom(itemId)

  const lift = captureLiftFromDom(itemId, item.width, item.height, item.type)
  if (!lift) return

  useCanvasCustomizeStore.getState().open(itemId, lift)
  playSound('menuOpen')
}

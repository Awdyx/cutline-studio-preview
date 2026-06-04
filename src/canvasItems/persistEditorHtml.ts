import { readEditorHtml } from './textEditorContent'
import { useCanvasItemsStore } from './canvasItemsStore'

/** Flush editor HTML to the canvas store (font menu, etc.). */
export function persistEditorHtmlNow(itemId: string, editor: HTMLElement): void {
  const root = document.querySelector(`[data-item-id="${itemId}"]`)
  const type = root?.getAttribute('data-canvas-item')
  const html = readEditorHtml(editor)
  const store = useCanvasItemsStore.getState()
  if (type === 'sticky') store.updateStickyText(itemId, html)
  else if (type === 'text') store.updateTextItemText(itemId, html)
}

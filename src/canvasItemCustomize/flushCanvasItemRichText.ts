import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { isStoredTextEmpty, readEditorHtml } from '../canvasItems/textEditorContent'

function richTextShellRoots(
  itemId: string,
  type: 'sticky' | 'text',
): HTMLElement[] {
  const hosts = new Set<HTMLElement>()
  document
    .querySelectorAll<HTMLElement>(
      `[data-canvas-item="${type}"][data-item-id="${itemId}"]`,
    )
    .forEach((el) => hosts.add(el))
  document
    .querySelectorAll<HTMLElement>(
      `[data-ui-canvas-item-customize-lift][data-item-id="${itemId}"]`,
    )
    .forEach((el) => hosts.add(el))
  return Array.from(hosts)
}

function portalEditorForItem(itemId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-ui-canvas-item-customize-lift][data-item-id="${itemId}"] [data-customize-content-instance="portal"] .canvas-text-editor`,
  )
}

function longestEditorHtml(editors: HTMLElement[]): string {
  let best = ''
  for (const editor of editors) {
    const html = readEditorHtml(editor)
    if (html.length > best.length) best = html
  }
  return best
}

/** Persist rich-text DOM into the store before customize portaling remounts the editor. */
export function flushCanvasItemRichTextFromDom(itemId: string): void {
  if (typeof document === 'undefined') return

  const store = useCanvasItemsStore.getState()
  const item = store.items.find((i) => i.id === itemId)
  if (!item || (item.type !== 'sticky' && item.type !== 'text')) return

  const portalEditor = portalEditorForItem(itemId)
  let bestHtml = portalEditor ? readEditorHtml(portalEditor) : ''

  if (!portalEditor) {
    const roots = richTextShellRoots(itemId, item.type)
    const editors = roots
      .map((root) => root.querySelector<HTMLElement>('.canvas-text-editor'))
      .filter((el): el is HTMLElement => el != null)
    bestHtml = longestEditorHtml(editors)
  }

  const active = document.activeElement
  if (active instanceof HTMLElement && active.classList.contains('canvas-text-editor')) {
    const host = active.closest<HTMLElement>(`[data-item-id="${itemId}"]`)
    if (
      host?.getAttribute('data-canvas-item') === item.type ||
      host?.hasAttribute('data-ui-canvas-item-customize-lift')
    ) {
      const html = readEditorHtml(active)
      if (html.length > bestHtml.length) bestHtml = html
    }
  }

  if (!bestHtml.trim()) {
    if (portalEditor) {
      if (item.type === 'sticky') store.commitStickyTextEdit(itemId, bestHtml)
      else store.commitTextItemEdit(itemId, bestHtml)
      return
    }
    if (!isStoredTextEmpty(item.text)) return
    return
  }

  if (item.type === 'sticky') {
    store.commitStickyTextEdit(itemId, bestHtml)
  } else {
    store.commitTextItemEdit(itemId, bestHtml)
  }
}

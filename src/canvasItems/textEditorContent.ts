import { parseInlineMarkdown } from './inlineMarkdown'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function looksLikeHtml(stored: string): boolean {
  return /<[a-z][\s\S]*>/i.test(stored.trim())
}

function looksLikeMarkdown(stored: string): boolean {
  return /(\*\*|__|~~|\+\+|\*(?!\*)|_(?!_))/u.test(stored)
}

/** Convert persisted value (HTML or legacy markdown) for the rich-text editor. */
export function storedContentToHtml(stored: string): string {
  if (!stored) return ''
  const trimmed = stored.trim()
  if (!trimmed) return ''
  if (looksLikeHtml(trimmed)) return stored
  if (looksLikeMarkdown(stored)) return parseInlineMarkdown(stored)
  return escapeHtml(stored).replace(/\n/g, '<br />')
}

/** Strip markup and invisible placeholder chars (e.g. caret ZWS) for emptiness checks. */
export function plainTextFromStored(stored: string): string {
  return stored
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[\s\u00a0\u200b\u200c\u200d\ufeff]/g, '')
}

export function readEditorHtml(el: HTMLElement): string {
  if (isEditorEmpty(el)) return ''
  return el.innerHTML
}

export function ensureEditorCaretAnchor(el: HTMLElement): void {
  if (!isEditorEmpty(el)) return
  el.innerHTML = '<br>'
}

export function isEditorEmpty(el: HTMLElement): boolean {
  const text = el.textContent ?? ''
  return plainTextFromStored(text).length === 0
}

export function isStoredTextEmpty(stored: string): boolean {
  if (!stored.trim()) return true
  return plainTextFromStored(stored).length === 0
}

/** True when focus or the current selection lives inside this rich-text editor. */
export function isRichTextEditorEngaged(
  editor: HTMLElement,
  eventTarget: EventTarget | null = null,
): boolean {
  const active = document.activeElement
  if (active === editor) return true
  if (active instanceof Node && editor.contains(active)) return true

  if (eventTarget instanceof Node && editor.contains(eventTarget)) return true

  const sel = window.getSelection()
  if (!sel) return false
  const anchor = sel.anchorNode
  const focus = sel.focusNode
  return (
    (anchor != null && editor.contains(anchor)) ||
    (focus != null && editor.contains(focus))
  )
}

function rectContainsPoint(rect: DOMRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

/** True when a pointer is over visible text (or the empty editor box), not surrounding padding. */
export function isPointerOverTextContent(
  editor: HTMLElement,
  clientX: number,
  clientY: number,
): boolean {
  if (isEditorEmpty(editor)) {
    return rectContainsPoint(editor.getBoundingClientRect(), clientX, clientY)
  }

  const doc = editor.ownerDocument
  const walker = doc.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
  let textNode = walker.nextNode() as Text | null
  while (textNode) {
    if ((textNode.nodeValue?.length ?? 0) === 0) {
      textNode = walker.nextNode() as Text | null
      continue
    }

    const range = doc.createRange()
    range.selectNodeContents(textNode)
    for (const rect of range.getClientRects()) {
      if (rectContainsPoint(rect, clientX, clientY)) return true
    }
    textNode = walker.nextNode() as Text | null
  }

  return false
}

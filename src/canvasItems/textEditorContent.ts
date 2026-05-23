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

export function readEditorHtml(el: HTMLElement): string {
  return el.innerHTML
}

export function isEditorEmpty(el: HTMLElement): boolean {
  const text = el.textContent?.replace(/\u00a0/g, ' ').trim() ?? ''
  return text.length === 0
}

export function isStoredTextEmpty(stored: string): boolean {
  if (!stored.trim()) return true
  const text = stored
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .trim()
  return text.length === 0
}

function rectContainsPoint(rect: DOMRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

/** True when a pointer is over visible text (or the empty placeholder box), not surrounding padding. */
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

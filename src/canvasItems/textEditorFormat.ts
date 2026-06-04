import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { readEditorHtml } from './textEditorContent'

export type TextFormatKind = 'bold' | 'italic' | 'underline' | 'strikethrough'

/** Maps to document.execCommand — standard contenteditable formatting (MDN / WHATWG). */
const EXEC_CMD: Record<TextFormatKind, string> = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  strikethrough: 'strikeThrough',
}

type FormatKeyEvent = KeyboardEvent | ReactKeyboardEvent

function editorHasText(editor: HTMLElement): boolean {
  return (editor.textContent?.length ?? 0) > 0
}

function selectionRangeInEditor(editor: HTMLElement): Range | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer)) return null
  return range
}

function collapseCaretToEnd(editor: HTMLElement): void {
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  range.selectNodeContents(editor)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
}

/**
 * Apply bold/italic/underline/strikethrough using the browser's native rich-text commands.
 * Partial highlight → formats selection only. Collapsed caret + text → formats entire block.
 */
export function applyRichTextFormat(
  editor: HTMLElement,
  kind: TextFormatKind,
): boolean {
  if (!editor.isContentEditable || !editorHasText(editor)) return false

  editor.focus({ preventScroll: true })

  const range = selectionRangeInEditor(editor)
  const hasHighlight = range != null && !range.collapsed

  if (!hasHighlight) {
    const sel = window.getSelection()
    if (!sel) return false
    const all = document.createRange()
    all.selectNodeContents(editor)
    sel.removeAllRanges()
    sel.addRange(all)
  }

  const ok = document.execCommand(EXEC_CMD[kind], false)

  if (!hasHighlight) collapseCaretToEnd(editor)

  return ok
}

export function handleTextFormatShortcutEvent(
  event: FormatKeyEvent,
  editor: HTMLElement,
  onApplied?: () => void,
): boolean {
  if (!isFormatModifierShortcut(event)) return false
  if (!editor.isContentEditable) return false

  const kind = formatKindFromShortcutKey(event.key, event.shiftKey)
  if (!kind) return false

  event.preventDefault()
  event.stopPropagation()

  if (!applyRichTextFormat(editor, kind)) return false

  onApplied?.()
  return true
}

export function applyTextFormatToAll(
  editor: HTMLElement,
  kind: TextFormatKind,
): string | null {
  if (!editorHasText(editor)) return null
  if (!applyRichTextFormat(editor, kind)) return null
  return readEditorHtml(editor)
}

export function formatKindFromShortcutKey(
  key: string,
  shiftKey: boolean,
): TextFormatKind | null {
  const k = key.toLowerCase()
  if (k === 'b') return 'bold'
  if (k === 'i') return 'italic'
  if (k === 'u') return 'underline'
  if (k === 'x' && shiftKey) return 'strikethrough'
  return null
}

export function isFormatModifierShortcut(e: {
  metaKey: boolean
  ctrlKey: boolean
  key: string
  shiftKey: boolean
}): boolean {
  if (!(e.metaKey || e.ctrlKey)) return false
  return formatKindFromShortcutKey(e.key, e.shiftKey) !== null
}

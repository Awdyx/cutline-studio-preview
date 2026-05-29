import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ensureEditorCaretAnchor } from './textEditorContent'

export type TextFormatKind = 'bold' | 'italic' | 'underline' | 'strikethrough'

const EXEC_COMMAND: Record<TextFormatKind, string> = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  strikethrough: 'strikeThrough',
}

type FormatKeyEvent = KeyboardEvent | ReactKeyboardEvent

function cloneSelectionRange(): Range | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  return selection.getRangeAt(0).cloneRange()
}

function restoreSelectionRange(editor: HTMLElement, range: Range | null): void {
  const selection = window.getSelection()
  if (!selection) return

  if (range && editor.contains(range.commonAncestorContainer)) {
    selection.removeAllRanges()
    selection.addRange(range)
    return
  }

  ensureEditorCaretAnchor(editor)
  const fallback = document.createRange()
  fallback.selectNodeContents(editor)
  fallback.collapse(false)
  selection.removeAllRanges()
  selection.addRange(fallback)
}

/**
 * Temporarily makes the editor contenteditable, selects all text, applies the
 * format, reads the resulting HTML, then resets — all without changing React
 * `isEditing` state so no editing UI is shown.
 */
export function applyTextFormatToAll(
  editor: HTMLElement,
  kind: TextFormatKind,
): string | null {
  if (!editor.textContent?.trim() && editor.innerHTML === '') return null

  const prevCE = editor.contentEditable
  editor.contentEditable = 'true'
  editor.focus({ preventScroll: true })

  const range = document.createRange()
  range.selectNodeContents(editor)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)

  document.execCommand(EXEC_COMMAND[kind], false)
  const html = editor.innerHTML

  sel?.removeAllRanges()
  editor.contentEditable = prevCE
  return html
}

export function applyTextFormat(editor: HTMLElement, kind: TextFormatKind): boolean {
  editor.focus({ preventScroll: true })
  const savedRange = cloneSelectionRange()
  restoreSelectionRange(editor, savedRange)
  return document.execCommand(EXEC_COMMAND[kind], false)
}

export function handleTextFormatShortcutEvent(
  event: FormatKeyEvent,
  editor: HTMLElement,
  onApplied?: () => void,
): boolean {
  if (!isFormatModifierShortcut(event)) return false

  const kind = formatKindFromShortcutKey(event.key, event.shiftKey)
  if (!kind) return false

  event.preventDefault()
  applyTextFormat(editor, kind)
  onApplied?.()
  return true
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

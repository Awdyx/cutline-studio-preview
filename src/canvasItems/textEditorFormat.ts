import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { readEditorHtml } from './textEditorContent'
import {
  editorBookmarkToRange,
  rangeToEditorBookmark,
  recallEditorSelection,
  rememberEditorSelection,
  resolveEditorSelectionBookmark,
  restoreEditorBookmark,
  type EditorSelectionBookmark,
} from './textEditorSelectionBookmark'

export type TextFormatKind = 'bold' | 'italic' | 'underline' | 'strikethrough'

const FORMAT_TAG: Record<TextFormatKind, string> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  strikethrough: 's',
}

const FORMAT_TAG_ALIASES: Record<TextFormatKind, readonly string[]> = {
  bold: ['strong', 'b'],
  italic: ['em', 'i'],
  underline: ['u'],
  strikethrough: ['s', 'strike', 'del'],
}

type FormatKeyEvent = KeyboardEvent | ReactKeyboardEvent

function editorTextLength(editor: HTMLElement): number {
  return editor.textContent?.length ?? 0
}

function isFormatTagName(tagName: string, kind: TextFormatKind): boolean {
  return FORMAT_TAG_ALIASES[kind].includes(tagName.toLowerCase())
}

function unwrapElement(el: HTMLElement): void {
  const parent = el.parentNode
  if (!parent) return
  while (el.firstChild) {
    parent.insertBefore(el.firstChild, el)
  }
  parent.removeChild(el)
}

function getTextNodesInRange(range: Range): Text[] {
  const root =
    range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentNode ?? range.commonAncestorContainer
      : range.commonAncestorContainer

  const nodes: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!(node instanceof Text)) return NodeFilter.FILTER_REJECT
      if (!node.nodeValue?.length) return NodeFilter.FILTER_SKIP
      return range.intersectsNode(node)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT
    },
  })

  let current = walker.nextNode() as Text | null
  while (current) {
    nodes.push(current)
    current = walker.nextNode() as Text | null
  }
  return nodes
}

function textNodeHasFormat(node: Text, kind: TextFormatKind): boolean {
  let parent = node.parentElement
  while (parent) {
    if (isFormatTagName(parent.tagName, kind)) return true
    parent = parent.parentElement
  }
  return false
}

function isRangeUniformlyFormatted(range: Range, kind: TextFormatKind): boolean {
  const textNodes = getTextNodesInRange(range)
  if (textNodes.length === 0) return false
  return textNodes.every((node) => textNodeHasFormat(node, kind))
}

function stripFormatTagsFromNode(root: Node, kind: TextFormatKind): void {
  if (root instanceof HTMLElement && isFormatTagName(root.tagName, kind)) {
    unwrapElement(root)
    return
  }

  const toUnwrap: HTMLElement[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  let el = walker.nextNode() as HTMLElement | null
  while (el) {
    if (isFormatTagName(el.tagName, kind)) toUnwrap.push(el)
    el = walker.nextNode() as HTMLElement | null
  }

  toUnwrap.sort((a, b) => {
    if (a.contains(b)) return 1
    if (b.contains(a)) return -1
    return 0
  })

  for (const node of toUnwrap) {
    if (node.parentNode) unwrapElement(node)
  }
}

function removeFormatFromRange(range: Range, kind: TextFormatKind): void {
  const fragment = range.extractContents()
  stripFormatTagsFromNode(fragment, kind)
  range.insertNode(fragment)
}

function wrapRangeWithFormat(range: Range, tagName: string): HTMLElement {
  const wrapper = document.createElement(tagName)
  try {
    range.surroundContents(wrapper)
  } catch {
    const contents = range.extractContents()
    wrapper.appendChild(contents)
    range.insertNode(wrapper)
  }
  return wrapper
}

/** Apply inline formatting to a bookmarked range without focus() or execCommand. */
export function applyTextFormatAtBookmark(
  editor: HTMLElement,
  kind: TextFormatKind,
  bookmark: EditorSelectionBookmark | null,
): EditorSelectionBookmark | null {
  let target = bookmark ?? resolveEditorSelectionBookmark(editor)

  if (!target || target.end <= target.start) {
    const len = editorTextLength(editor)
    if (len === 0) return null
    target = { start: 0, end: len }
  }

  const range = editorBookmarkToRange(editor, target)
  if (!range || range.collapsed) return null

  if (isRangeUniformlyFormatted(range, kind)) {
    removeFormatFromRange(range, kind)
    restoreEditorBookmark(editor, target)
    return target
  }

  const wrapper = wrapRangeWithFormat(range, FORMAT_TAG[kind])

  const selection = document.createRange()
  selection.selectNodeContents(wrapper)
  const nextBookmark = rangeToEditorBookmark(editor, selection)
  restoreEditorBookmark(editor, nextBookmark ?? target)
  return nextBookmark ?? target
}

/**
 * Format the current highlight, or all text when nothing is selected.
 * Works while the editor is or isn't contentEditable — no focus() calls.
 */
export function applyTextFormatToAll(
  editor: HTMLElement,
  kind: TextFormatKind,
): string | null {
  if (!editor.textContent?.trim() && editor.innerHTML === '') return null

  rememberEditorSelection(editor)
  const bookmark =
    resolveEditorSelectionBookmark(editor) ??
    recallEditorSelection(editor) ??
    (editorTextLength(editor) > 0
      ? { start: 0, end: editorTextLength(editor) }
      : null)

  applyTextFormatAtBookmark(editor, kind, bookmark)
  return readEditorHtml(editor)
}

export function applyTextFormat(
  editor: HTMLElement,
  kind: TextFormatKind,
  bookmark?: EditorSelectionBookmark | null,
): boolean {
  return applyTextFormatAtBookmark(editor, kind, bookmark ?? null) != null
}

export function handleTextFormatShortcutEvent(
  event: FormatKeyEvent,
  editor: HTMLElement,
  onApplied?: () => void,
): boolean {
  if (!isFormatModifierShortcut(event)) return false

  const kind = formatKindFromShortcutKey(event.key, event.shiftKey)
  if (!kind) return false

  rememberEditorSelection(editor)
  const bookmark =
    resolveEditorSelectionBookmark(editor) ?? recallEditorSelection(editor)

  event.preventDefault()
  event.stopPropagation()

  applyTextFormatAtBookmark(editor, kind, bookmark)
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

export { captureEditorSelection } from './textEditorSelectionBookmark'

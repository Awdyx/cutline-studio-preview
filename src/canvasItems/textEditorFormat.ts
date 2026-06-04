import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { readEditorHtml } from './textEditorContent'
import {
  collapseEditorCaretToEnd,
  documentEditBookmark,
  editorBookmarkToRange,
  rangeToEditorBookmark,
  recallEditorSelection,
  rememberEditorSelection,
  resolveEditTarget,
  restoreEditorBookmark,
  type EditTarget,
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

function postApplySelection(
  editor: HTMLElement,
  target: EditTarget,
  bookmark: EditorSelectionBookmark,
): void {
  if (target.mode === 'document') collapseEditorCaretToEnd(editor)
  else restoreEditorBookmark(editor, bookmark)
}

/** Apply inline formatting via DOM only (no execCommand, no pre-restore). */
export function applyTextFormatForTarget(
  editor: HTMLElement,
  kind: TextFormatKind,
  target: EditTarget,
): boolean {
  const bookmark =
    target.mode === 'partial'
      ? target.bookmark
      : documentEditBookmark(editor)
  if (!bookmark) return false

  const range = editorBookmarkToRange(editor, bookmark)
  if (!range || range.collapsed) return false

  if (isRangeUniformlyFormatted(range, kind)) {
    removeFormatFromRange(range, kind)
    postApplySelection(editor, target, bookmark)
    return true
  }

  const wrapper = wrapRangeWithFormat(range, FORMAT_TAG[kind])
  const probe = document.createRange()
  probe.selectNodeContents(wrapper)
  const nextBookmark = rangeToEditorBookmark(editor, probe) ?? bookmark
  postApplySelection(editor, target, nextBookmark)
  return true
}

/** @deprecated Prefer applyTextFormatForTarget + resolveEditTarget. */
export function applyTextFormatAtBookmark(
  editor: HTMLElement,
  kind: TextFormatKind,
  bookmark: EditorSelectionBookmark | null,
): EditorSelectionBookmark | null {
  const target: EditTarget | null = bookmark
    ? bookmark.end > bookmark.start
      ? { mode: 'partial', bookmark }
      : { mode: 'document' }
    : resolveEditTarget(editor)
  if (!target) return null
  return applyTextFormatForTarget(editor, kind, target)
    ? bookmark ?? (target.mode === 'partial' ? target.bookmark : documentEditBookmark(editor))
    : null
}

export function applyTextFormatToAll(
  editor: HTMLElement,
  kind: TextFormatKind,
): string | null {
  if (!editor.textContent?.trim() && editor.innerHTML === '') return null

  const target = resolveEditTarget(editor)
  if (!target) return null

  applyTextFormatForTarget(editor, kind, target)
  return readEditorHtml(editor)
}

export function applyTextFormat(
  editor: HTMLElement,
  kind: TextFormatKind,
  bookmark?: EditorSelectionBookmark | null,
): boolean {
  if (bookmark && bookmark.end > bookmark.start) {
    return applyTextFormatForTarget(editor, kind, {
      mode: 'partial',
      bookmark,
    })
  }
  const target = resolveEditTarget(editor)
  return target != null && applyTextFormatForTarget(editor, kind, target)
}

export function handleTextFormatShortcutEvent(
  event: FormatKeyEvent,
  editor: HTMLElement,
  onApplied?: () => void,
): boolean {
  if (!isFormatModifierShortcut(event)) return false

  const kind = formatKindFromShortcutKey(event.key, event.shiftKey)
  if (!kind) return false

  const target = resolveEditTarget(editor)
  if (!target) return false

  event.preventDefault()
  event.stopPropagation()

  if (!applyTextFormatForTarget(editor, kind, target)) return false

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

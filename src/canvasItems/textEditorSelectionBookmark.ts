export type EditorSelectionBookmark = {
  start: number
  end: number
}

const lastNonCollapsedBookmark = new WeakMap<HTMLElement, EditorSelectionBookmark>()

function normalizeEditorRange(range: Range): Range {
  const normalized = range.cloneRange()
  if (normalized.collapsed) return normalized
  if (normalized.compareBoundaryPoints(Range.START_TO_END, normalized) <= 0) {
    return normalized
  }
  const startContainer = normalized.startContainer
  const startOffset = normalized.startOffset
  normalized.setStart(normalized.endContainer, normalized.endOffset)
  normalized.setEnd(startContainer, startOffset)
  return normalized
}

/** Snapshot the current selection when it lies inside the editor. */
export function captureEditorSelection(editor: HTMLElement): Range | null {
  const selection = window.getSelection()
  if (!selection) return null

  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    if (editor.contains(range.commonAncestorContainer)) {
      return normalizeEditorRange(range)
    }
  }

  const { anchorNode, focusNode, anchorOffset, focusOffset } = selection
  if (!anchorNode || !focusNode) return null
  if (!editor.contains(anchorNode) && !editor.contains(focusNode)) return null

  try {
    const range = document.createRange()
    const focusBeforeAnchor =
      anchorNode === focusNode
        ? focusOffset < anchorOffset
        : (anchorNode.compareDocumentPosition(focusNode) &
            Node.DOCUMENT_POSITION_PRECEDING) !==
          0
    if (focusBeforeAnchor) {
      range.setStart(focusNode, focusOffset)
      range.setEnd(anchorNode, anchorOffset)
    } else {
      range.setStart(anchorNode, anchorOffset)
      range.setEnd(focusNode, focusOffset)
    }
    if (!editor.contains(range.commonAncestorContainer)) return null
    return range
  } catch {
    return null
  }
}

function textOffsetInEditor(
  editor: HTMLElement,
  container: Node,
  offset: number,
): number | null {
  if (!editor.contains(container)) return null
  try {
    const probe = document.createRange()
    probe.selectNodeContents(editor)
    probe.setEnd(container, offset)
    const scratch = document.createElement('div')
    scratch.appendChild(probe.cloneContents())
    return scratch.textContent?.length ?? 0
  } catch {
    return null
  }
}

function resolveTextPosition(
  editor: HTMLElement,
  targetOffset: number,
): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
  let walked = 0
  let textNode = walker.nextNode() as Text | null
  let lastTextNode: Text | null = null

  while (textNode) {
    lastTextNode = textNode
    const next = walked + textNode.data.length
    if (targetOffset <= next) {
      return { node: textNode, offset: targetOffset - walked }
    }
    walked = next
    textNode = walker.nextNode() as Text | null
  }

  if (lastTextNode && targetOffset === walked) {
    return { node: lastTextNode, offset: lastTextNode.data.length }
  }

  return null
}

export function rangeToEditorBookmark(
  editor: HTMLElement,
  range: Range,
): EditorSelectionBookmark | null {
  if (!editor.contains(range.commonAncestorContainer)) return null

  const start = textOffsetInEditor(editor, range.startContainer, range.startOffset)
  const end = textOffsetInEditor(editor, range.endContainer, range.endOffset)
  if (start == null || end == null) return null

  return start <= end ? { start, end } : { start: end, end: start }
}

export function editorBookmarkToRange(
  editor: HTMLElement,
  bookmark: EditorSelectionBookmark,
): Range | null {
  const startPos = resolveTextPosition(editor, bookmark.start)
  const endPos = resolveTextPosition(editor, bookmark.end)
  if (!startPos || !endPos) return null

  try {
    const range = document.createRange()
    range.setStart(startPos.node, startPos.offset)
    range.setEnd(endPos.node, endPos.offset)
    return range
  } catch {
    return null
  }
}

export function rememberEditorSelection(editor: HTMLElement): void {
  const range = captureEditorSelection(editor)
  if (!range || range.collapsed) return
  const bookmark = rangeToEditorBookmark(editor, range)
  if (bookmark && bookmark.end > bookmark.start) {
    lastNonCollapsedBookmark.set(editor, bookmark)
  }
}

export function recallEditorSelection(
  editor: HTMLElement,
): EditorSelectionBookmark | null {
  return lastNonCollapsedBookmark.get(editor) ?? null
}

export function restoreEditorBookmark(
  editor: HTMLElement,
  bookmark: EditorSelectionBookmark | null,
): boolean {
  if (!bookmark) return false
  const range = editorBookmarkToRange(editor, bookmark)
  if (!range) return false

  const selection = window.getSelection()
  if (!selection) return false

  selection.removeAllRanges()
  selection.addRange(range)
  return true
}

export function ensureEditorFocused(editor: HTMLElement): void {
  const active = document.activeElement
  if (active === editor) return
  if (active instanceof Node && editor.contains(active)) return
  editor.focus({ preventScroll: true })
}

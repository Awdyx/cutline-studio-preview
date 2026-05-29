import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { isEditorEmpty } from './textEditorContent'
import { STUDIO_SPAWN_SIZE_SCALE } from './types'

export const TEXT_ITEM_DEFAULT_FONT_SIZE = Math.round(16 * STUDIO_SPAWN_SIZE_SCALE)
export const STICKY_DEFAULT_FONT_SIZE = Math.round(15 * STUDIO_SPAWN_SIZE_SCALE)

export const FONT_SIZE_MIN = 8
export const FONT_SIZE_MAX = 72
export const FONT_SIZE_STEP = 2

type FontSizeKeyEvent = KeyboardEvent | ReactKeyboardEvent

export function clampFontSize(px: number): number {
  const clamped = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(px)))
  // Snap to nearest even number
  return clamped % 2 === 0 ? clamped : clamped + 1
}

function parsePxFromFontSize(value: string): number | null {
  const m = value.trim().match(/^([\d.]+)px$/i)
  if (m) return Math.round(parseFloat(m[1]))
  const pt = value.trim().match(/^([\d.]+)pt$/i)
  if (pt) return Math.round((parseFloat(pt[1]) * 96) / 72)
  const raw = value.trim().match(/^([\d.]+)$/)
  if (raw) return Math.round(parseFloat(raw[1]))
  return null
}

function readInlineFontSizePx(el: HTMLElement): number | null {
  return el.style.fontSize ? parsePxFromFontSize(el.style.fontSize) : null
}

export function getFontSizeAtCaret(editor: HTMLElement, defaultPx: number): number {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return defaultPx
  const range = selection.getRangeAt(0)
  let node: Node | null = range.startContainer
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
  while (node && node !== editor) {
    if (node instanceof HTMLElement) {
      const px = readInlineFontSizePx(node)
      if (px != null) return px
    }
    node = node.parentNode
  }
  return defaultPx
}

export function getFontSizeAtRange(
  editor: HTMLElement,
  range: Range,
  defaultPx: number,
): number {
  let node: Node | null = range.startContainer
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
  while (node && node !== editor) {
    if (node instanceof HTMLElement) {
      const px = readInlineFontSizePx(node)
      if (px != null) return px
    }
    node = node.parentNode
  }
  return defaultPx
}

/** Best-effort read when no editor is focused — scans stored HTML for last font-size. */
export function readDominantFontSizeFromStored(
  stored: string,
  defaultPx: number,
): number {
  const matches = [...stored.matchAll(/font-size:\s*([\d.]+)px/gi)]
  if (matches.length === 0) return defaultPx
  return clampFontSize(parseFloat(matches[matches.length - 1][1]))
}

// ─── Core DOM mutations ──────────────────────────────────────────────────────

function wrapRangeWithFontSpan(range: Range, sizePx: number): boolean {
  const span = document.createElement('span')
  span.style.fontSize = `${sizePx}px`

  // Try surroundContents first (works when range stays inside one element)
  try {
    range.surroundContents(span)
  } catch {
    // Range crosses element boundaries — extract, wrap, re-insert
    try {
      const fragment = range.extractContents()
      span.appendChild(fragment)
      range.insertNode(span)
    } catch {
      return false
    }
  }

  // Re-select the wrapped content
  const sel = window.getSelection()
  if (sel) {
    const newRange = document.createRange()
    newRange.selectNodeContents(span)
    sel.removeAllRanges()
    sel.addRange(newRange)
  }
  return true
}

function insertTypingSpan(range: Range, sizePx: number): boolean {
  // Insert a span with a zero-width space so the browser routes typed text into it
  const span = document.createElement('span')
  span.style.fontSize = `${sizePx}px`
  const zws = document.createTextNode('\u200b')
  span.appendChild(zws)

  try {
    range.insertNode(span)
  } catch {
    return false
  }

  const sel = window.getSelection()
  if (sel) {
    const caret = document.createRange()
    caret.setStart(zws, 1)
    caret.collapse(true)
    sel.removeAllRanges()
    sel.addRange(caret)
  }
  return true
}

/** Empty editor: anchor caret in a span at the spawn default size so typed text picks it up. */
export function prepareEditorForTyping(editor: HTMLElement, defaultPx: number): void {
  editor.style.fontSize = `${defaultPx}px`
  if (!isEditorEmpty(editor)) return

  editor.innerHTML = ''
  return insertTypingSpan(
    (() => {
      const range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(true)
      return range
    })(),
    defaultPx,
  )
}

// ─── Public API ──────────────────────────────────────────────────────────────

export type FontSizeDirection = 'increase' | 'decrease'

/**
 * Shift every font-size span in the editor by `delta`, and wrap bare text
 * nodes (no explicit size ancestor) at `defaultPx + delta`.
 * Used when no text is selected.
 */
function shiftAllFontSizes(
  editor: HTMLElement,
  defaultPx: number,
  delta: number,
): boolean {
  let changed = false

  // 1. Adjust every explicit font-size span
  editor.querySelectorAll<HTMLElement>('span[style]').forEach((span) => {
    const current = readInlineFontSizePx(span)
    if (current != null) {
      const next = clampFontSize(current + delta)
      if (next !== current) {
        span.style.fontSize = `${next}px`
        changed = true
      }
    }
  })

  // 2. Collect text nodes that have no font-size ancestor (use the default size)
  const newDefault = clampFontSize(defaultPx + delta)
  if (newDefault !== defaultPx) {
    const walker = editor.ownerDocument.createTreeWalker(
      editor,
      NodeFilter.SHOW_TEXT,
    )
    const bare: Text[] = []
    let t = walker.nextNode() as Text | null
    while (t) {
      // Skip whitespace-only nodes
      if ((t.nodeValue ?? '').replace(/[\s\u200b]/g, '').length > 0) {
        // Check ancestors for an explicit font-size
        let ancestor: Node | null = t.parentNode
        let hasExplicit = false
        while (ancestor && ancestor !== editor) {
          if (
            ancestor instanceof HTMLElement &&
            readInlineFontSizePx(ancestor) != null
          ) {
            hasExplicit = true
            break
          }
          ancestor = ancestor.parentNode
        }
        if (!hasExplicit) bare.push(t)
      }
      t = walker.nextNode() as Text | null
    }

    // Wrap each bare text node in a span at the new default size
    for (const node of bare) {
      const span = document.createElement('span')
      span.style.fontSize = `${newDefault}px`
      node.parentNode?.insertBefore(span, node)
      span.appendChild(node)
      changed = true
    }
  }

  return changed
}

/**
 * Apply a font-size change to whatever the editor currently has selected.
 * When nothing is selected (collapsed caret), shifts ALL text in the editor
 * relative to their current sizes.
 * Called directly from onKeyDown / button clicks — does NOT touch focus.
 */
export function changeEditorFontSize(
  editor: HTMLElement,
  direction: FontSizeDirection,
  defaultPx: number,
): boolean {
  const delta = direction === 'increase' ? FONT_SIZE_STEP : -FONT_SIZE_STEP

  const selection = window.getSelection()
  const range = selection && selection.rangeCount > 0
    ? selection.getRangeAt(0)
    : null

  // No selection (or selection outside editor) → shift everything
  if (!range || !editor.contains(range.commonAncestorContainer) || range.collapsed) {
    return shiftAllFontSizes(editor, defaultPx, delta)
  }

  // Selection → only wrap selected text
  const currentPx = getFontSizeAtRange(editor, range, defaultPx)
  const nextPx = clampFontSize(currentPx + delta)
  if (nextPx === currentPx) return false
  return wrapRangeWithFontSpan(range, nextPx)
}

export function setEditorFontSize(
  editor: HTMLElement,
  sizePx: number,
  _defaultPx: number,
): boolean {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return false

  const range = selection.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer)) return false

  const nextPx = clampFontSize(sizePx)

  return range.collapsed
    ? insertTypingSpan(range, nextPx)
    : wrapRangeWithFontSpan(range, nextPx)
}

export function fontSizeDirectionFromKey(key: string): FontSizeDirection | null {
  if (key === ']') return 'increase'
  if (key === '[') return 'decrease'
  return null
}

export function fontSizeDirectionFromCode(code: string): FontSizeDirection | null {
  if (code === 'BracketRight') return 'increase'
  if (code === 'BracketLeft') return 'decrease'
  return null
}

export function fontSizeDirectionFromKeyboardEvent(
  event: Pick<KeyboardEvent, 'key' | 'code'>,
): FontSizeDirection | null {
  return (
    fontSizeDirectionFromKey(event.key) ?? fontSizeDirectionFromCode(event.code)
  )
}

const MODIFIER_KEY_CODES = new Set([
  'MetaLeft',
  'MetaRight',
  'ControlLeft',
  'ControlRight',
])

export const FONT_SIZE_BRACKET_KEY_CODES = new Set(['BracketLeft', 'BracketRight'])

/** True while ⌘/Ctrl is physically held (layout-agnostic). */
export function isFontSizeModifierHeld(
  keysDown: ReadonlySet<string>,
  modifierLatch = false,
): boolean {
  for (const code of keysDown) {
    if (MODIFIER_KEY_CODES.has(code)) return true
  }
  return modifierLatch
}

/** Bracket key went up — macOS may use `key` when `code` is empty on keyup. */
export function isFontSizeBracketKeyRelease(
  event: Pick<KeyboardEvent, 'key' | 'code' | 'keyCode'>,
): boolean {
  if (FONT_SIZE_BRACKET_KEY_CODES.has(event.code)) return true
  if (fontSizeDirectionFromKey(event.key) != null) return true
  if (event.keyCode === 221 || event.keyCode === 219) return true
  return false
}

export function isFontSizeShortcut(e: {
  metaKey: boolean
  ctrlKey: boolean
  altKey?: boolean
  key: string
}): boolean {
  if (!(e.metaKey || e.ctrlKey)) return false
  if (e.altKey) return false
  return fontSizeDirectionFromKey(e.key) !== null
}

export function handleFontSizeShortcutEvent(
  event: FontSizeKeyEvent,
  editor: HTMLElement,
  defaultPx: number,
  onApplied?: () => void,
): boolean {
  if (!isFontSizeShortcut(event)) return false

  const direction = fontSizeDirectionFromKey(event.key)
  if (!direction) return false

  if (changeEditorFontSize(editor, direction, defaultPx)) {
    onApplied?.()
  }
  return true
}

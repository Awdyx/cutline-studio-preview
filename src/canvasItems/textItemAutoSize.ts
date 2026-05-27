import {
  TEXT_MAX_AUTO_WIDTH,
  TEXT_MIN_HEIGHT,
  TEXT_MIN_WIDTH,
} from './types'

/**
 * Measures the minimum width needed so no word gets broken across lines.
 * Uses white-space:nowrap so the browser renders everything on one line,
 * giving us the true widest-word / longest-line width.
 */
function measureNaturalWidth(editor: HTMLElement): number {
  const style = editor.style
  const prevWhiteSpace = style.whiteSpace
  const prevWidth = style.width
  const prevMaxWidth = style.maxWidth

  // Force single-line, unconstrained so we measure the true content width
  style.whiteSpace = 'nowrap'
  style.width = 'max-content'
  style.maxWidth = 'none'

  const naturalWidth = Math.min(
    Math.ceil(Math.max(TEXT_MIN_WIDTH, editor.offsetWidth)),
    TEXT_MAX_AUTO_WIDTH,
  )

  style.whiteSpace = prevWhiteSpace
  style.width = prevWidth
  style.maxWidth = prevMaxWidth

  return naturalWidth
}

export function measureTextItemContentBounds(
  editor: HTMLElement,
  currentWidth: number,
  currentHeight: number,
): {
  width: number
  height: number
} {
  const style = editor.style
  const prevWidth = style.width
  const prevMaxWidth = style.maxWidth
  const prevHeight = style.height

  // Never let the box be narrower than the widest single word
  const naturalWidth = measureNaturalWidth(editor)
  const wrapWidth = Math.max(currentWidth, naturalWidth)

  style.width = `${wrapWidth}px`
  style.maxWidth = `${TEXT_MAX_AUTO_WIDTH}px`
  style.height = 'auto'

  const wrappedHeight = Math.ceil(
    Math.max(TEXT_MIN_HEIGHT, editor.offsetHeight),
  )

  style.width = prevWidth
  style.maxWidth = prevMaxWidth
  style.height = prevHeight

  return {
    width: Math.max(currentWidth, naturalWidth),
    height: Math.max(currentHeight, wrappedHeight),
  }
}

/** Measures the tightest box that fits the content — used when shrinking on deselect. */
export function measureTextItemShrinkBounds(editor: HTMLElement): {
  width: number
  height: number
} {
  const style = editor.style
  const prevWidth = style.width
  const prevMaxWidth = style.maxWidth
  const prevHeight = style.height

  // Tight width: never narrower than the longest word
  const tightWidth = measureNaturalWidth(editor)

  style.width = `${tightWidth}px`
  style.maxWidth = `${TEXT_MAX_AUTO_WIDTH}px`
  style.height = 'auto'

  const tightHeight = Math.ceil(Math.max(TEXT_MIN_HEIGHT, editor.offsetHeight))

  style.width = prevWidth
  style.maxWidth = prevMaxWidth
  style.height = prevHeight

  return { width: tightWidth, height: tightHeight }
}

export function fitTextItemRectAroundCenter(
  x: number,
  y: number,
  prevWidth: number,
  prevHeight: number,
  nextWidth: number,
  nextHeight: number,
): { x: number; y: number; width: number; height: number } {
  const centerX = x + prevWidth / 2
  const centerY = y + prevHeight / 2
  return {
    x: centerX - nextWidth / 2,
    y: centerY - nextHeight / 2,
    width: nextWidth,
    height: nextHeight,
  }
}

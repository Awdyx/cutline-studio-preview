/** Prefer the focused anchor, then any visible copy. */
export function queryUiPinElement(pinId: string): HTMLElement | null {
  const focusedPin = document.querySelector<HTMLElement>(
    `[data-ui-anchor-focused='1'] [data-ui-pin='${pinId}']`,
  )
  if (focusedPin) return focusedPin

  const matches = document.querySelectorAll<HTMLElement>(
    `[data-ui-pin='${pinId}']`,
  )
  for (const el of matches) {
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) return el
  }
  return matches[0] ?? null
}

export function uiPinScreenRect(pinId: string): DOMRect | null {
  const el = queryUiPinElement(pinId)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return rect
}

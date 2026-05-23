/** Blur inputs/editors that stole focus during mount (common on iOS Safari). */
export function blurStrayTextFocus(): void {
  const el = document.activeElement
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  ) {
    el.blur()
  }
}

export function prefersCoarsePointer(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches
}

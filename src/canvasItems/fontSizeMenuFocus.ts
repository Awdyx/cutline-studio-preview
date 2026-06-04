/** True when focus moved to the floating +/- font-size chrome. */
export function isFontSizeMenuFocusTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('[data-text-font-size-menu]') != null
  )
}

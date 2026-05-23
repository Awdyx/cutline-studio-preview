import { playSound } from './playSound'

/** Row hover is silent — only taps/clicks play submenu SFX. */
export function playSubmenuHover(): void {}

export function playSubmenuTap(): void {
  playSound('submenuTap')
}

export function submenuRowHoverProps(): { onMouseEnter: () => void } {
  return { onMouseEnter: () => playSubmenuHover() }
}

/** Run handler, then optional tap (handler first so e.g. re-enabling SFX unmutes before the tap). */
export function runSubmenuClick(handler: () => void, playTap = true): void {
  handler()
  if (playTap) playSubmenuTap()
}

import { CHROME_TAP_SQUEEZE_TARGET_CLASS } from '../styles/tokens'

export const CHROME_TAP_SQUEEZE_PULSE_CLASS = 'chrome-tap-squeeze--pulse'
export const CHROME_TAP_SQUEEZE_ANIMATION = 'chrome-tap-squeeze'

export const CHROME_TAP_SQUEEZE_TRIGGERS = [
  '[data-panel-trigger]',
  '[data-fab-trigger]',
  '[data-pen-fab-trigger]',
  '[data-space-back-trigger]',
  '.canvas-search-island',
].join(',')

const DEBOUNCE_MS = 200
const lastPulseAt = new WeakMap<HTMLElement, number>()

export function resolveChromeTapSqueezeTarget(trigger: HTMLElement): HTMLElement {
  if (trigger.classList.contains(CHROME_TAP_SQUEEZE_TARGET_CLASS)) return trigger
  const wrapped = trigger.closest(`.${CHROME_TAP_SQUEEZE_TARGET_CLASS}`)
  if (wrapped instanceof HTMLElement) return wrapped
  return trigger
}

export function triggerChromeTapPulse(target: HTMLElement) {
  const now = Date.now()
  const last = lastPulseAt.get(target) ?? 0
  if (now - last < DEBOUNCE_MS) return
  lastPulseAt.set(target, now)
  target.classList.remove(CHROME_TAP_SQUEEZE_PULSE_CLASS)
  void target.offsetWidth
  target.classList.add(CHROME_TAP_SQUEEZE_PULSE_CLASS)
}

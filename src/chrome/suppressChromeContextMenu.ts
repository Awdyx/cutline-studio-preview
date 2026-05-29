/** Surfaces where the browser context menu should not appear. */
export const CHROME_CONTEXT_MENU_ROOTS = [
  '.cutline-top-bar',
  '.ui-chrome-glass',
  '.ui-chrome-card',
  '.canvas-search-island',
  '.pen-tool-pill',
  '[data-pen-fab]',
  '[data-plus-fab]',
  '[data-cutline-submenu]',
  '[data-cutline-submenu-anchor]',
  '[data-phone-chrome-modal-scrim]',
  '[data-plus-fab-submenu]',
  '[data-notification-profile-preview]',
  '[data-notification-profile-preview-scrim]',
  '[data-notifications-panel]',
  '[data-canvas-context-menu]',
  '[data-canvas-item-z-menu]',
  '[data-space-back-pill]',
  '[data-profile-submenu]',
  '[data-profile-save-bubble]',
  '[data-profile-panel-header]',
  '[data-ui-customization-toolbar]',
  '[data-ui-customization-tray]',
  '[data-ui-customization-backdrop]',
  '[data-ui-pin-toolbar]',
  '[data-ui-pin]',
] as const

function allowsNativeTextContextMenu(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  const field = target.closest('input, textarea')
  if (!field) return false
  // Canvas item editors use contenteditable; keep the app menu behavior there.
  return !field.closest('[data-item-id]')
}

export function shouldSuppressAppContextMenu(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true
  if (allowsNativeTextContextMenu(target)) return false
  return true
}

export function shouldSuppressChromeContextMenu(target: EventTarget | null): boolean {
  return shouldSuppressAppContextMenu(target)
}

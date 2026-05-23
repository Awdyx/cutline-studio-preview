/** Pointer hit on another chrome menu — defer dismiss to that menu's open handler (one sfx). */
export function isSwapChromeMenuTarget(target: Node): boolean {
  if (!(target instanceof Element)) return false
  return (
    !!target.closest('[data-pen-fab]') ||
    !!target.closest('[data-plus-fab]') ||
    !!target.closest('[data-panel-trigger]') ||
    !!target.closest('[data-cutline-submenu]') ||
    !!target.closest('[data-notification-profile-preview]')
  )
}

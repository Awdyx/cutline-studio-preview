/** Pointer hit on another chrome menu — defer dismiss to that menu's open handler (one sfx). */
export function isSwapChromeMenuTarget(target: Node): boolean {
  if (!(target instanceof Element)) return false
  return (
    !!target.closest('[data-pen-fab]') ||
    !!target.closest('[data-plus-fab]') ||
    !!target.closest('[data-panel-trigger]') ||
    !!target.closest('[data-cutline-submenu]') ||
    !!target.closest('[data-phone-chrome-modal-scrim]') ||
    !!target.closest('[data-plus-fab-submenu]') ||
    !!target.closest('[data-notification-profile-preview]') ||
    !!target.closest('[data-notification-profile-preview-scrim]')
  )
}

/** Keep pen FAB open while drawing / picking tools on these surfaces. */
export function isPenFabDrawKeepOpenTarget(target: Node): boolean {
  if (!(target instanceof Element)) return false
  return (
    !!target.closest('[data-study-hub-scratch-pad]') ||
    !!target.closest('.study-hub-menu-focus-portal') ||
    !!target.closest('.pen-tool-pill') ||
    !!target.closest('.pen-tool-pill-settings')
  )
}

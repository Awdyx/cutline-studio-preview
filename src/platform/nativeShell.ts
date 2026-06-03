/** Desktop native shells: Electron (macOS Chromium) and Tauri (iOS / legacy macOS). */

declare global {
  interface Window {
    cutlineShell?: { kind: 'electron'; macOverlay?: boolean }
  }
}

export function isElectronDesktop(): boolean {
  if (typeof window === 'undefined') return false
  return window.cutlineShell?.kind === 'electron'
}

export function isTauriDesktop(): boolean {
  if (typeof window === 'undefined') return false
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window
}

/** Packaged macOS/iOS-style app (not the public website). */
export function isNativeDesktop(): boolean {
  return isElectronDesktop() || isTauriDesktop()
}

function isApplePlatform(): boolean {
  return /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent)
}

/** macOS overlay title bar (Electron or Tauri desktop). */
export function isNativeMacOverlay(): boolean {
  if (typeof window !== 'undefined' && window.cutlineShell?.macOverlay) {
    return true
  }
  return isApplePlatform() && (isElectronDesktop() || isTauriDesktop())
}

export function syncNativeShellAttributes(): boolean {
  const native = isNativeDesktop()
  const macOverlay = isNativeMacOverlay()

  if (native) {
    document.documentElement.dataset.nativeDesktop = '1'
  } else {
    delete document.documentElement.dataset.nativeDesktop
  }

  if (isElectronDesktop()) {
    document.documentElement.dataset.electronDesktop = '1'
  } else {
    delete document.documentElement.dataset.electronDesktop
  }

  if (isTauriDesktop()) {
    document.documentElement.dataset.tauriDesktop = '1'
  } else {
    delete document.documentElement.dataset.tauriDesktop
  }

  if (macOverlay) {
    document.documentElement.dataset.nativeMacos = '1'
    // Legacy attribute — existing CSS
    if (isTauriDesktop()) {
      document.documentElement.dataset.tauriMacos = '1'
    } else {
      delete document.documentElement.dataset.tauriMacos
    }
    if (isElectronDesktop()) {
      document.documentElement.dataset.electronMacos = '1'
    } else {
      delete document.documentElement.dataset.electronMacos
    }
  } else {
    delete document.documentElement.dataset.nativeMacos
    delete document.documentElement.dataset.tauriMacos
    delete document.documentElement.dataset.electronMacos
  }

  return native
}

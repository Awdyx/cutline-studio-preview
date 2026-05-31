export function isTauriDesktop(): boolean {
  if (typeof window === 'undefined') return false
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window
}

export function isTauriMacOS(): boolean {
  if (!isTauriDesktop()) return false
  return /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent)
}

export function syncTauriDesktopAttribute(): boolean {
  const active = isTauriDesktop()
  if (active) {
    document.documentElement.dataset.tauriDesktop = '1'
    if (isTauriMacOS()) {
      document.documentElement.dataset.tauriMacos = '1'
    } else {
      delete document.documentElement.dataset.tauriMacos
    }
  } else {
    delete document.documentElement.dataset.tauriDesktop
    delete document.documentElement.dataset.tauriMacos
  }
  return active
}

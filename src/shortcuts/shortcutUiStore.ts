import { create } from 'zustand'
import type { ShortcutDef } from './shortcutDefs'

export type ToastPayload = {
  shortcutId: string
  label: string
  keys: string[]
  icon?: ShortcutDef['icon']
  /** Defaults to 1200ms. Errors often need longer. */
  holdMs?: number
}

export type ChromeMenuSoundOpts = {
  /** Skip menuClose — used when swapping to another chrome menu (one sound total). */
  silent?: boolean
}

type PlusFabControls = {
  open: () => void
  close: (opts?: ChromeMenuSoundOpts) => void
  isOpen: () => boolean
}

type ToolPaletteControls = {
  close: (opts?: ChromeMenuSoundOpts) => void
  isOpen: () => boolean
  closeColorPopover: () => void
  isColorPopoverOpen: () => boolean
}

type AppPanelControls = {
  close: (opts?: ChromeMenuSoundOpts) => void
}

type ChromeSubmenuControls = {
  closeSubmenus: () => void
}

type NotificationProfilePreviewControls = {
  close: (opts?: ChromeMenuSoundOpts) => void
  isOpen: () => boolean
}

type CanvasSearchControls = {
  focus: () => void
  closeDropdown: () => void
  isDropdownOpen: () => boolean
  isInputFocused: () => boolean
  blurInput: () => void
}

type ShortcutUiState = {
  canvasSearch: CanvasSearchControls | null
  registerCanvasSearch: (controls: CanvasSearchControls | null) => void
  plusFab: PlusFabControls | null
  registerPlusFab: (controls: PlusFabControls | null) => void
  toolPalette: ToolPaletteControls | null
  registerToolPalette: (controls: ToolPaletteControls | null) => void
  appPanels: AppPanelControls | null
  registerAppPanels: (controls: AppPanelControls | null) => void
  cutlineMenu: ChromeSubmenuControls | null
  registerCutlineMenu: (controls: ChromeSubmenuControls | null) => void
  profileMenu: ChromeSubmenuControls | null
  registerProfileMenu: (controls: ChromeSubmenuControls | null) => void
  notificationProfilePreview: NotificationProfilePreviewControls | null
  registerNotificationProfilePreview: (
    controls: NotificationProfilePreviewControls | null,
  ) => void
  closeAllChromeSubmenus: () => void
  /** Close flyout submenus and actor profile cards before swapping chrome UI. */
  dismissPeerChromeOverlays: (opts?: ChromeMenuSoundOpts) => void
  dismissChromeForCanvasInteraction: () => void
  /** Close other chrome menus silently before opening a FAB (one sfx on swap). */
  dismissPeerChromeForFab: (opening: 'plus' | 'pen') => void
  toast: ToastPayload | null
  toastNonce: number
  showActionToast: (payload: ToastPayload) => void
  clearToast: () => void
}

export const useShortcutUiStore = create<ShortcutUiState>((set, get) => ({
  canvasSearch: null,
  registerCanvasSearch: (controls) => set({ canvasSearch: controls ?? null }),

  plusFab: null,
  registerPlusFab: (controls) => set({ plusFab: controls ?? null }),

  toolPalette: null,
  registerToolPalette: (controls) => set({ toolPalette: controls ?? null }),

  appPanels: null,
  registerAppPanels: (controls) => set({ appPanels: controls ?? null }),

  cutlineMenu: null,
  registerCutlineMenu: (controls) => set({ cutlineMenu: controls ?? null }),

  profileMenu: null,
  registerProfileMenu: (controls) => set({ profileMenu: controls ?? null }),

  notificationProfilePreview: null,
  registerNotificationProfilePreview: (controls) =>
    set({ notificationProfilePreview: controls ?? null }),

  closeAllChromeSubmenus: () => {
    const s = get()
    s.cutlineMenu?.closeSubmenus()
    s.profileMenu?.closeSubmenus()
  },

  dismissPeerChromeOverlays: (opts) => {
    const s = get()
    s.closeAllChromeSubmenus()
    if (s.notificationProfilePreview?.isOpen()) {
      s.notificationProfilePreview.close(opts)
    }
  },

  dismissChromeForCanvasInteraction: () => {
    const s = get()
    s.dismissPeerChromeOverlays()
    s.appPanels?.close()
    if (s.plusFab?.isOpen()) s.plusFab.close()
    if (s.toolPalette?.isColorPopoverOpen()) s.toolPalette.closeColorPopover()
    if (s.canvasSearch?.isDropdownOpen()) s.canvasSearch.closeDropdown()
  },

  dismissPeerChromeForFab: (opening) => {
    const s = get()
    s.dismissPeerChromeOverlays({ silent: true })
    s.appPanels?.close({ silent: true })
    if (opening !== 'plus') s.plusFab?.close({ silent: true })
    if (opening !== 'pen') s.toolPalette?.close({ silent: true })
  },

  toast: null,
  toastNonce: 0,
  showActionToast: (payload) =>
    set((s) => ({
      toast: payload,
      toastNonce: s.toastNonce + 1,
    })),
  clearToast: () => set({ toast: null }),
}))

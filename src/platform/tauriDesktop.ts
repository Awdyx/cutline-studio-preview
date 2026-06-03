/** Re-exports — prefer `nativeShell.ts` for new code. */
export {
  isElectronDesktop,
  isNativeDesktop,
  isNativeMacOverlay,
  isTauriDesktop,
  syncNativeShellAttributes,
  syncNativeShellAttributes as syncTauriDesktopAttribute,
} from './nativeShell'

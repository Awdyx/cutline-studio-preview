import { isTauriDesktop } from '../platform/tauriDesktop'

/** Invisible top strip so the window can be dragged with an overlay title bar. */
export default function TauriWindowDragRegion() {
  if (!isTauriDesktop()) return null

  return <div className="tauri-window-drag-region" data-tauri-drag-region aria-hidden />
}

import { isNativeMacOverlay } from '../platform/nativeShell'

/** Invisible top strip so the window can be dragged with an overlay title bar. */
export default function TauriWindowDragRegion() {
  if (!isNativeMacOverlay()) return null

  return (
    <div
      className="native-window-drag-region"
      data-tauri-drag-region=""
      aria-hidden
    />
  )
}

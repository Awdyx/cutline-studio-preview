import { useEffect } from 'react'
import { shouldSuppressAppContextMenu } from '../chrome/suppressChromeContextMenu'

/** Block the browser right-click menu across the app (except native text fields). */
export function useSuppressChromeContextMenu(): void {
  useEffect(() => {
    const capture = { capture: true } as const

    function onContextMenu(event: MouseEvent) {
      if (!shouldSuppressAppContextMenu(event.target)) return
      event.preventDefault()
    }

    document.addEventListener('contextmenu', onContextMenu, capture)
    return () => document.removeEventListener('contextmenu', onContextMenu, capture)
  }, [])
}

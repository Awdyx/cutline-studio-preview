import { useEffect, type RefObject } from 'react'
import { isSwapChromeMenuTarget } from './chromeMenuDismiss'
import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'

type Options = {
  active: boolean
  panelRef: RefObject<HTMLElement | null>
  onDismiss: (target: Element) => void
  /** Return true when the pointer hit should not dismiss (e.g. portaled submenus). */
  isInside?: (target: Element) => boolean
  /** When true, taps on the anchor panel also dismiss (e.g. close open flyouts). */
  dismissInsidePanel?: boolean
}

/** Capture-phase pointer dismiss — reliable on canvas/touch, before pan handlers run. */
export function useMenuOutsideDismiss({
  active,
  panelRef,
  onDismiss,
  isInside,
  dismissInsidePanel = false,
}: Options) {
  useEffect(() => {
    if (!active) return

    function handlePointerDown(e: PointerEvent) {
      const target = e.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-panel-trigger]')) {
        useShortcutUiStore.getState().dismissPeerChromeOverlays({ silent: true })
        return
      }
      if (isSwapChromeMenuTarget(target)) return
      if (isInside?.(target)) return
      if (panelRef.current?.contains(target) && !dismissInsidePanel) return
      onDismiss(target)
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [active, dismissInsidePanel, onDismiss, panelRef, isInside])
}

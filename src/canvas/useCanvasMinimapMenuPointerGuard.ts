import { useEffect } from 'react'
import { useCanvasMinimapStore } from './canvasMinimapStore'

const MENU_FRAME = '.canvas-minimap-expanded-menu__frame'
const MENU_SCRIM = '.canvas-minimap-expanded-scrim'
const STUDIO_PLATE = '.canvas-minimap-expanded-menu__plate'

/** Block pointer events from reaching the canvas while the expanded map is open. */
export function useCanvasMinimapMenuPointerGuard() {
  const open = useCanvasMinimapStore((s) => s.expandedOpen)

  useEffect(() => {
    if (!open) return

    const isMenuSurface = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false
      return (
        target.closest(MENU_FRAME) != null ||
        target.closest(MENU_SCRIM) != null
      )
    }

    const isStudioPlate = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false
      return target.closest(STUDIO_PLATE) != null
    }

    const blockUnlessPlate = (event: PointerEvent) => {
      if (!isMenuSurface(event.target)) return
      if (isStudioPlate(event.target)) return
      event.preventDefault()
      event.stopPropagation()
    }

    document.addEventListener('pointerdown', blockUnlessPlate, true)
    document.addEventListener('pointermove', blockUnlessPlate, true)

    return () => {
      document.removeEventListener('pointerdown', blockUnlessPlate, true)
      document.removeEventListener('pointermove', blockUnlessPlate, true)
    }
  }, [open])
}

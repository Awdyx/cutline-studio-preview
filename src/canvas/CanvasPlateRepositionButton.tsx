import { useCallback } from 'react'
import { openCanvasMinimapFromReposition } from './canvasMinimapOpen'
import { useCanvasOverviewStore } from './canvasOverviewStore'
import { useStudioCentreDragStore } from './studioCentreDragStore'
import { playSubmenuTap } from '../sound/submenuSound'

/** Control below the studio plate — opens the expanded canvas map. */
export default function CanvasPlateRepositionButton() {
  const engaged = useCanvasOverviewStore((s) => s.engaged)
  const minimapDragging = useStudioCentreDragStore((s) => s.minimapDragging)
  const studioCentreDragging = useStudioCentreDragStore((s) => s.studioCentreDragging)
  const chromeVisible = !minimapDragging && !studioCentreDragging

  const onClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    playSubmenuTap()
    openCanvasMinimapFromReposition()
  }, [])

  if (!engaged) return null

  return (
    <button
      type="button"
      className="canvas-plate-reposition-btn"
      aria-label="Open canvas map to reposition pockets"
      style={{
        left: '50%',
        transform: 'translateX(-50%)',
        pointerEvents: chromeVisible ? 'auto' : 'none',
        opacity: chromeVisible ? 1 : 0,
      }}
      onClick={onClick}
    >
      reposition
    </button>
  )
}

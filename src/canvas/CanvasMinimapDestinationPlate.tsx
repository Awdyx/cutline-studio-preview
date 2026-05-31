import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  canvasMinimapStudioRect,
  canvasRectToRegionPercent,
  CANVAS_MINIMAP_PLATE_TITLE_LIFT_PX,
  type CanvasMinimapRect,
} from './canvasMinimapGeometry'
import { onStudioCentreMinimapDragPointerDown } from './studioCentreDrag'
import { panCanvasMinimapToItem } from './canvasMinimapPanToItem'
import { playSubmenuTap } from '../sound/submenuSound'
import { useStudioCentreDragStore } from './studioCentreDragStore'
import { useStudioCentrePositionStore } from './studioCentrePositionStore'
import { registerStudioCentreMinimapPlateWrap } from './studioCentreVisualDrag'
import StudioCentreContentPreview from './StudioCentreContentPreview'
import { useAppDestinationActive } from '../navigation/useAppDestinationActive'

const PLATE_TITLE_LIFT_PX = CANVAS_MINIMAP_PLATE_TITLE_LIFT_PX

type Props = {
  mapRegion: CanvasMinimapRect
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  frameRef: RefObject<HTMLDivElement | null>
}

export default function CanvasMinimapDestinationPlate({
  mapRegion,
  transformRef,
  frameRef,
}: Props) {
  const reduceMotion = useReducedMotion()
  const selected = useAppDestinationActive('studio')
  const wrapRef = useRef<HTMLDivElement>(null)
  const [navigating, setNavigating] = useState(false)

  const studioX = useStudioCentrePositionStore((s) => s.x)
  const studioY = useStudioCentrePositionStore((s) => s.y)

  useEffect(() => {
    registerStudioCentreMinimapPlateWrap(wrapRef.current)
    return () => registerStudioCentreMinimapPlateWrap(null)
  }, [])

  const platePct = useMemo(
    () => canvasRectToRegionPercent(canvasMinimapStudioRect(), mapRegion),
    [studioX, studioY, mapRegion],
  )

  const onPlateTap = useCallback(() => {
    playSubmenuTap()
    setNavigating(true)
    panCanvasMinimapToItem(transformRef, canvasMinimapStudioRect())
  }, [transformRef])

  const onPlatePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()

      const frame = frameRef.current
      if (!frame) return

      const frameRect = frame.getBoundingClientRect()
      if (frameRect.width <= 0 || frameRect.height <= 0) return

      const pctX = (event.clientX - frameRect.left) / frameRect.width
      const pctY = (event.clientY - frameRect.top) / frameRect.height
      const canvasX = mapRegion.x + pctX * mapRegion.width
      const canvasY = mapRegion.y + pctY * mapRegion.height

      useStudioCentreDragStore.getState().setPanSuppressed(true)

      onStudioCentreMinimapDragPointerDown(
        event,
        frame,
        canvasX - studioX,
        canvasY - studioY,
        mapRegion,
        onPlateTap,
      )
    },
    [frameRef, mapRegion, onPlateTap, studioX, studioY],
  )

  return (
    <motion.div
      ref={wrapRef}
      className={`canvas-minimap-expanded-menu__plate-wrap canvas-minimap-expanded-menu__space${
        navigating ? ' canvas-minimap-expanded-menu__plate-wrap--navigate' : ''
      }${selected ? ' canvas-minimap-expanded-menu__plate-wrap--selected' : ''}`}
      onAnimationEnd={() => setNavigating(false)}
      style={{
        left: `${platePct.left}%`,
        top: `calc(${platePct.top}% - ${PLATE_TITLE_LIFT_PX}px)`,
        width: `${platePct.width}%`,
        height: `calc(${platePct.height}% + ${PLATE_TITLE_LIFT_PX}px)`,
        zIndex: 2,
      }}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      transition={
        reduceMotion
          ? { duration: 0.1 }
          : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
      }
    >
      <p className="canvas-minimap-expanded-menu__plate-title" aria-hidden>
        <span className="canvas-minimap-expanded-menu__plate-title-word">
          studio
        </span>
        <span className="canvas-minimap-expanded-menu__plate-title-heart">
          &lt;3
        </span>
      </p>
      <button
        type="button"
        className="canvas-minimap-expanded-menu__plate"
        aria-label="Move studio space, or click to go to it"
        onPointerDown={onPlatePointerDown}
      >
        <div className="canvas-minimap-expanded-menu__plate-preview">
          <StudioCentreContentPreview />
        </div>
      </button>
    </motion.div>
  )
}

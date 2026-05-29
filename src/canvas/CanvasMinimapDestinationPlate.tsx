import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  canvasMinimapFeaturePlateRect,
  canvasMinimapStudioRect,
  canvasRectToRegionPercent,
  CANVAS_MINIMAP_PLATE_TITLE_LIFT_PX,
  type CanvasMinimapRect,
} from './canvasMinimapGeometry'
import {
  FEATURE_PLATE_TITLES,
  FEATURE_PLATE_TITLE_SUFFIX,
  type FeaturePlateDestination,
} from './canvasPlate'
import { onFeaturePlateMinimapDragPointerDown } from './featurePlateDrag'
import { onStudioCentreMinimapDragPointerDown } from './studioCentreDrag'
import { panCanvasMinimapToItem } from './canvasMinimapPanToItem'
import { playSubmenuTap } from '../sound/submenuSound'
import { useStudioCentreDragStore } from './studioCentreDragStore'
import { useStudioCentrePositionStore } from './studioCentrePositionStore'
import { useFeaturePlatePositionStore } from './featurePlatePositionStore'
import { registerFeaturePlateMinimapWrap } from './featurePlateVisualDrag'
import { registerStudioCentreMinimapPlateWrap } from './studioCentreVisualDrag'
import StudioCentreContentPreview from './StudioCentreContentPreview'
import type { AppDestination } from '../navigation/appDestinationStore'
import { useAppDestinationActive } from '../navigation/useAppDestinationActive'

const PLATE_TITLE_LIFT_PX = CANVAS_MINIMAP_PLATE_TITLE_LIFT_PX

type Props = {
  destination: AppDestination
  mapRegion: CanvasMinimapRect
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  frameRef: RefObject<HTMLDivElement | null>
  variant: 'studio' | 'feature'
}

function plateTitle(destination: AppDestination): string {
  if (destination === 'studio') return 'studio'
  return FEATURE_PLATE_TITLES[destination as FeaturePlateDestination]
}

export default function CanvasMinimapDestinationPlate({
  destination,
  mapRegion,
  transformRef,
  frameRef,
  variant,
}: Props) {
  const reduceMotion = useReducedMotion()
  const selected = useAppDestinationActive(destination)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [navigating, setNavigating] = useState(false)

  const studioX = useStudioCentrePositionStore((s) => s.x)
  const studioY = useStudioCentrePositionStore((s) => s.y)
  const featureX = useFeaturePlatePositionStore(
    (s) => s.positions[destination as FeaturePlateDestination]?.x ?? 0,
  )
  const featureY = useFeaturePlatePositionStore(
    (s) => s.positions[destination as FeaturePlateDestination]?.y ?? 0,
  )

  const plateX = variant === 'studio' ? studioX : featureX
  const plateY = variant === 'studio' ? studioY : featureY

  useEffect(() => {
    if (variant === 'studio') {
      registerStudioCentreMinimapPlateWrap(wrapRef.current)
      return () => registerStudioCentreMinimapPlateWrap(null)
    }
    registerFeaturePlateMinimapWrap(
      destination as FeaturePlateDestination,
      wrapRef.current,
    )
    return () =>
      registerFeaturePlateMinimapWrap(
        destination as FeaturePlateDestination,
        null,
      )
  }, [destination, variant])

  const platePct = useMemo(() => {
    const rect =
      variant === 'studio'
        ? canvasMinimapStudioRect()
        : canvasMinimapFeaturePlateRect(destination as FeaturePlateDestination)
    return canvasRectToRegionPercent(rect, mapRegion)
  }, [destination, mapRegion, plateX, plateY, variant])

  const onPlateTap = useCallback(() => {
    playSubmenuTap()
    setNavigating(true)
    const rect =
      variant === 'studio'
        ? canvasMinimapStudioRect()
        : canvasMinimapFeaturePlateRect(destination as FeaturePlateDestination)
    panCanvasMinimapToItem(transformRef, rect)
  }, [destination, transformRef, variant])

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

      if (variant === 'studio') {
        onStudioCentreMinimapDragPointerDown(
          event,
          frame,
          canvasX - studioX,
          canvasY - studioY,
          mapRegion,
          onPlateTap,
        )
        return
      }

      onFeaturePlateMinimapDragPointerDown(
        destination as FeaturePlateDestination,
        event,
        frame,
        canvasX - plateX,
        canvasY - plateY,
        mapRegion,
        onPlateTap,
      )
    },
    [
      destination,
      frameRef,
      mapRegion,
      onPlateTap,
      plateX,
      plateY,
      studioX,
      studioY,
      variant,
    ],
  )

  const title = plateTitle(destination)
  const zIndex = variant === 'studio' ? 2 : 1

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
        zIndex,
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
          {title}
        </span>
        <span className="canvas-minimap-expanded-menu__plate-title-heart">
          {variant === 'studio'
            ? '<3'
            : FEATURE_PLATE_TITLE_SUFFIX[destination as FeaturePlateDestination]}
        </span>
      </p>
      <button
        type="button"
        className={`canvas-minimap-expanded-menu__plate${
          variant === 'feature' ? ' canvas-minimap-expanded-menu__plate--feature' : ''
        }`}
        aria-label={`Move ${title} space, or click to go to it`}
        onPointerDown={onPlatePointerDown}
      >
        {variant === 'studio' ? (
          <div className="canvas-minimap-expanded-menu__plate-preview">
            <StudioCentreContentPreview />
          </div>
        ) : (
          <div
            className="canvas-minimap-expanded-menu__plate-preview canvas-minimap-expanded-menu__plate-preview--feature"
            aria-hidden
          />
        )}
      </button>
    </motion.div>
  )
}

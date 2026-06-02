import { memo } from 'react'
import { resolveStrokeFill } from '../drawing/colorUtils'
import { ErasingStrokePaths } from '../drawing/ErasingStrokePaths'
import { strokeToSvgPath } from '../drawing/strokePath'
import { useThemeStore } from '../theme/themeStore'
import { useEffectiveMode } from '../theme/useEffectiveMode'
import type { Stroke } from '../drawing/types'
import { useCanvasItemsStore } from './canvasItemsStore'

const ActiveStrokePath = memo(function ActiveStrokePath({
  stroke,
  fill,
}: {
  stroke: Stroke
  fill: string
}) {
  const d = strokeToSvgPath(stroke, false)
  if (!d) return null
  return <path d={d} fill={fill} />
})

export default function StickyStrokesSvg({
  strokes,
  annotationStrokes,
  width,
  height,
  stickyId,
}: {
  strokes: Stroke[]
  annotationStrokes: Stroke[]
  width: number
  height: number
  stickyId: string
}) {
  const themeMode = useThemeStore((s) => s.mode)
  const effectiveMode = useEffectiveMode(themeMode)
  const active = useCanvasItemsStore(
    (s) =>
      s.activeStickyStroke?.stickyId === stickyId ? s.activeStickyStroke.stroke : null,
  )
  const strokeFill = (stroke: Stroke) =>
    resolveStrokeFill(stroke.color, stroke.tool, effectiveMode)

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    >
      <ErasingStrokePaths strokes={strokes} pathD={(s) => s.path} fill={strokeFill} />
      <g data-lock-sticky-annotation>
        <ErasingStrokePaths
          strokes={annotationStrokes}
          pathD={(s) => s.path}
          fill={strokeFill}
        />
        {active && (
          <ActiveStrokePath
            stroke={active}
            fill={resolveStrokeFill(active.color, active.tool, effectiveMode)}
          />
        )}
      </g>
    </svg>
  )
}

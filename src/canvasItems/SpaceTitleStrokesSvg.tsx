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

export default function SpaceTitleStrokesSvg({
  strokes,
  width,
  height,
  spaceId,
}: {
  strokes: Stroke[]
  width: number
  height: number
  spaceId: string
}) {
  const themeMode = useThemeStore((s) => s.mode)
  const effectiveMode = useEffectiveMode(themeMode)
  const active = useCanvasItemsStore(
    (s) =>
      s.activeSpaceTitleStroke?.spaceId === spaceId
        ? s.activeSpaceTitleStroke.stroke
        : null,
  )
  const strokeFill = (stroke: Stroke) =>
    resolveStrokeFill(stroke.color, stroke.tool, effectiveMode)

  if (strokes.length === 0 && !active) return null

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        pointerEvents: 'none',
      }}
    >
      <ErasingStrokePaths strokes={strokes} pathD={(s) => s.path} fill={strokeFill} />
      {active && (
        <ActiveStrokePath
          stroke={active}
          fill={resolveStrokeFill(active.color, active.tool, effectiveMode)}
        />
      )}
    </svg>
  )
}

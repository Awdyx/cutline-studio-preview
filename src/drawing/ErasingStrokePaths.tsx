import { memo } from 'react'
import type { Stroke } from './types'
import { useStrokeEraseVisualStore } from './strokeEraseVisualStore'

const StrokePath = memo(function StrokePath({
  d,
  fill,
  erasing,
}: {
  d: string
  fill: string
  erasing: boolean
}) {
  return (
    <path
      d={d}
      fill={fill}
      className={erasing ? 'cutline-stroke-erasing' : undefined}
    />
  )
})

export function ErasingStrokePaths({
  strokes,
  pathD,
  fill,
}: {
  strokes: Stroke[]
  pathD: (stroke: Stroke) => string | null | undefined
  fill: (stroke: Stroke) => string
}) {
  const erasingIds = useStrokeEraseVisualStore((s) => s.erasingIds)

  return strokes.map((stroke) => {
    const d = pathD(stroke)
    if (!d) return null
    return (
      <StrokePath
        key={stroke.id}
        d={d}
        fill={fill(stroke)}
        erasing={erasingIds.has(stroke.id)}
      />
    )
  })
}

import type { GrabHandleSide } from './grabZone'

const ROW_Y = [9, 15, 21] as const
const DOT_R = 1.3

/** Inner two columns of Lucide Grip — outer column toward the canvas edge is omitted. */
function columnXs(side: GrabHandleSide): readonly [number, number] {
  return side === 'left' ? [12, 19] : [5, 12]
}

function viewBoxForSide(side: GrabHandleSide): string {
  const [x0, x1] = columnXs(side)
  const pad = 1
  const minX = x0 - DOT_R - pad
  const maxX = x1 + DOT_R + pad
  const minY = ROW_Y[0] - DOT_R - pad
  const maxY = ROW_Y[ROW_Y.length - 1] + DOT_R + pad
  return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`
}

export default function DragGripIcon({
  size = 15,
  side = 'left',
}: {
  size?: number
  side?: GrabHandleSide
}) {
  const xs = columnXs(side)

  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBoxForSide(side)}
      aria-hidden
      style={{ display: 'block', overflow: 'visible' }}
    >
      {xs.flatMap((cx) =>
        ROW_Y.map((cy) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={DOT_R} fill="currentColor" />
        )),
      )}
    </svg>
  )
}

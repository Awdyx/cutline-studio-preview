import type { AppDestination } from '../navigation/appDestinationStore'
import { useAppDestinationActive } from '../navigation/useAppDestinationActive'

type Props = {
  destination: AppDestination
}

/** Soft plate frame — four gradient edges with open corners (pointer-events: none). */
export default function CanvasPlateBoundsOverlay({ destination }: Props) {
  const active = useAppDestinationActive(destination)

  return (
    <div
      className={`canvas-plate-bounds studio-centre-bounds${
        active ? ' canvas-plate-bounds--active studio-centre-bounds--active' : ''
      }`}
      data-canvas-plate-bounds={destination}
      aria-hidden
    >
      <div className="studio-centre-bounds__edge studio-centre-bounds__edge--top" />
      <div className="studio-centre-bounds__edge studio-centre-bounds__edge--bottom" />
      <div className="studio-centre-bounds__edge studio-centre-bounds__edge--left" />
      <div className="studio-centre-bounds__edge studio-centre-bounds__edge--right" />
    </div>
  )
}

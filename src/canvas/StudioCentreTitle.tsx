import { useAppDestinationActive } from '../navigation/useAppDestinationActive'

const STUDIO_TITLE_WORD = 'studio'
const STUDIO_TITLE_HEART = '<3'

/** Label above the studio-centre, shown in canvas overview. */
export default function StudioCentreTitle() {
  const active = useAppDestinationActive('studio')

  return (
    <p
      className={`studio-centre-title${active ? ' studio-centre-title--active' : ''}`}
      aria-hidden
      style={{ overflow: 'visible' }}
    >
      <span className="studio-centre-title__glow">
        <span className="studio-centre-title__word">{STUDIO_TITLE_WORD}</span>
        <span className="studio-centre-title__heart">{STUDIO_TITLE_HEART}</span>
      </span>
    </p>
  )
}

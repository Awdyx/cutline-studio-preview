import type { CSSProperties } from 'react'
import {
  GraduationCap,
  LayoutDashboard,
  MessagesSquare,
  Trophy,
  UsersRound,
} from 'lucide-react'
import {
  useAppDestinationStore,
  type AppDestination,
} from '../navigation/appDestinationStore'
import { chromeLabel, font } from '../styles/tokens'
import { MenuRow } from './MenuRow'

const sectionHeaderStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.5px',
  color: font.colorMuted,
  padding: '12px 16px 6px',
  margin: 0,
}

function ActiveDestinationDot() {
  return (
    <span
      aria-hidden
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: '#3ecf6e',
        boxShadow: '0 0 4px rgba(62, 207, 110, 0.6)',
        flexShrink: 0,
      }}
    />
  )
}

export default function CutlineAppNavSection({ onNavigate }: { onNavigate: () => void }) {
  const destination = useAppDestinationStore((s) => s.destination)
  const setDestination = useAppDestinationStore((s) => s.setDestination)

  const goTo = (next: AppDestination) => {
    setDestination(next)
    onNavigate()
  }

  return (
    <>
      <p style={sectionHeaderStyle}>{chromeLabel('General')}</p>
      <MenuRow
        icon={LayoutDashboard}
        label="Studio"
        inset
        active={destination === 'studio'}
        right={destination === 'studio' ? <ActiveDestinationDot /> : undefined}
        onClick={() => goTo('studio')}
      />
      <MenuRow icon={Trophy} label="Rankings" inset disabled onClick={() => {}} />
      <MenuRow icon={MessagesSquare} label="Forum" inset disabled onClick={() => {}} />
      <MenuRow icon={UsersRound} label="Groups" inset disabled onClick={() => {}} />
      <MenuRow icon={GraduationCap} label="UCAT" inset disabled onClick={() => {}} />
    </>
  )
}

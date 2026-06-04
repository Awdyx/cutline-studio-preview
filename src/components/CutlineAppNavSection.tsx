import type { CSSProperties, RefObject } from 'react'
import { LayoutDashboard, MessagesSquare, NotebookPen } from 'lucide-react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { panToAppDestination } from '../navigation/panToAppDestination'
import { useAppDestinationStore } from '../navigation/appDestinationStore'
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

export default function CutlineAppNavSection({
  onNavigate,
  transformRef,
  onRevealAdvancedMenu,
  onShowComingSoon,
}: {
  onNavigate: (opts?: { silent?: boolean }) => void
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  onRevealAdvancedMenu: () => void
  onShowComingSoon: () => void
}) {
  const destination = useAppDestinationStore((s) => s.destination)
  const setDestination = useAppDestinationStore((s) => s.setDestination)
  const studioActive = destination === 'studio'

  const goToStudio = () => {
    setDestination('studio')
    panToAppDestination(transformRef, 'studio')
    onNavigate({ silent: true })
  }

  return (
    <>
      <p style={sectionHeaderStyle}>{chromeLabel('General')}</p>
      <MenuRow
        icon={LayoutDashboard}
        label="Studio"
        inset
        active={studioActive}
        right={studioActive ? <ActiveDestinationDot /> : undefined}
        onClick={goToStudio}
        onContextMenu={() => onRevealAdvancedMenu()}
        onDoubleActivate={() => onRevealAdvancedMenu()}
      />
      <MenuRow icon={MessagesSquare} label="Forum" inset onClick={onShowComingSoon} />
      <MenuRow icon={NotebookPen} label="Memo" inset onClick={onShowComingSoon} />
    </>
  )
}

import type { CSSProperties, RefObject } from 'react'
import {
  GraduationCap,
  LayoutDashboard,
  MessagesSquare,
  Trophy,
  UsersRound,
} from 'lucide-react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { panToAppDestination } from '../navigation/panToAppDestination'
import { useCanvasStudioViewportZoneStore } from '../canvas/canvasStudioViewportZoneStore'
import {
  useAppDestinationStore,
  type AppDestination,
} from '../navigation/appDestinationStore'
import { chromeLabel, font } from '../styles/tokens'
import { useUiCustomizationStore } from '../uiCustomization/uiCustomizationStore'
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
}: {
  onNavigate: (opts?: { silent?: boolean }) => void
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
}) {
  const destination = useAppDestinationStore((s) => s.destination)
  const setDestination = useAppDestinationStore((s) => s.setDestination)
  const nearStudioViewport = useCanvasStudioViewportZoneStore((s) => s.nearStudioViewport)
  const editingUi = useUiCustomizationStore((s) => s.editing)
  const studioAtViewport = editingUi || nearStudioViewport
  const studioActive = destination === 'studio' && studioAtViewport

  const goTo = (next: AppDestination) => {
    setDestination(next)
    panToAppDestination(transformRef, next)
    onNavigate({ silent: true })
  }

  const plateAtViewport = (dest: AppDestination) => {
    if (dest === 'studio') return studioAtViewport
    return destination === dest && studioAtViewport
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
        onClick={() => goTo('studio')}
      />
      <MenuRow
        icon={Trophy}
        label="Rankings"
        inset
        active={plateAtViewport('leaderboard')}
        right={
          plateAtViewport('leaderboard') ? <ActiveDestinationDot /> : undefined
        }
        onClick={() => goTo('leaderboard')}
      />
      <MenuRow
        icon={MessagesSquare}
        label="Forum"
        inset
        active={plateAtViewport('forum')}
        right={plateAtViewport('forum') ? <ActiveDestinationDot /> : undefined}
        onClick={() => goTo('forum')}
      />
      <MenuRow
        icon={UsersRound}
        label="Groups"
        inset
        active={plateAtViewport('groups')}
        right={plateAtViewport('groups') ? <ActiveDestinationDot /> : undefined}
        onClick={() => goTo('groups')}
      />
      <MenuRow
        icon={GraduationCap}
        label="UCAT"
        inset
        active={plateAtViewport('ucat')}
        right={plateAtViewport('ucat') ? <ActiveDestinationDot /> : undefined}
        onClick={() => goTo('ucat')}
      />
    </>
  )
}

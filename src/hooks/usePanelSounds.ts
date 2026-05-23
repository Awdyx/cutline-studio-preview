import { useEffect, useRef, type MutableRefObject } from 'react'
import { playSound } from '../sound/playSound'

const PANEL_IDS = new Set([
  'news',
  'notifications',
  'profile',
  'cutline',
])

function activePanelId(panel: string | null): string | null {
  return panel && PANEL_IDS.has(panel) ? panel : null
}

export function usePanelSounds(
  openPanel: string | null,
  suppressCloseRef?: MutableRefObject<boolean>,
) {
  const prevPanel = useRef<string | null>(null)

  useEffect(() => {
    const wasPanel = activePanelId(prevPanel.current)
    const isPanel = activePanelId(openPanel)

    if (wasPanel && isPanel && wasPanel !== isPanel) {
      // Swap panels in one step — one open sound, not close + open.
      playSound('menuOpen')
    } else if (!wasPanel && isPanel) {
      playSound('menuOpen')
    } else if (wasPanel && !isPanel) {
      if (suppressCloseRef?.current) {
        suppressCloseRef.current = false
      } else {
        playSound('menuClose')
      }
    }

    prevPanel.current = openPanel
  }, [openPanel, suppressCloseRef])
}

import { useEffect, useRef } from 'react'
import { playSound } from '../sound/playSound'

const PANEL_IDS = new Set([
  'notifications',
  'profile',
  'cutline',
  'whats-new',
])

export function usePanelSounds(
  openPanel: string | null,
  unlockModalOpen: boolean,
) {
  const prevPanel = useRef<string | null>(null)
  const prevModal = useRef(false)

  useEffect(() => {
    const wasPanel = prevPanel.current
    const isPanel = openPanel && PANEL_IDS.has(openPanel) ? openPanel : null

    if (!wasPanel && isPanel) playSound('menuOpen')
    if (wasPanel && !isPanel) playSound('menuClose')

    prevPanel.current = openPanel
  }, [openPanel])

  useEffect(() => {
    if (!prevModal.current && unlockModalOpen) playSound('modalOpen')
    prevModal.current = unlockModalOpen
  }, [unlockModalOpen])
}

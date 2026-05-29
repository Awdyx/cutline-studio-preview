import { useEffect, useRef } from 'react'
import { useAppDestinationStore } from './appDestinationStore'
import {
  resolveBrandPillAreaLabel,
  type BrandPillAreaLabel,
} from './brandPillAreaLabel'
import { useCanvasStudioViewportZoneStore } from '../canvas/canvasStudioViewportZoneStore'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import { playPlateFocusSound } from '../sound/plateFocusSound'
import { useUiCustomizationStore } from '../uiCustomization/uiCustomizationStore'

const PLATE_FOCUS_COOLDOWN_MS = 300

/** Play when the Cutline brand pill label lands on an area name. */
export function useAppDestinationHighlightSound() {
  const destination = useAppDestinationStore((s) => s.destination)
  const nearPlateViewport = useCanvasStudioViewportZoneStore((s) => s.nearStudioViewport)
  const editingUi = useUiCustomizationStore((s) => s.editing)
  const insideSpace = useCanvasWorkspaceStore((s) => s.activeCanvasId !== 'main')
  const prevLabelRef = useRef<BrandPillAreaLabel | null>(null)
  const lastPlayedAtRef = useRef(0)

  useEffect(() => {
    if (insideSpace) {
      prevLabelRef.current = resolveBrandPillAreaLabel()
      return
    }

    const label = resolveBrandPillAreaLabel()
    const prev = prevLabelRef.current

    if (prev === null) {
      prevLabelRef.current = label
      return
    }

    if (label !== prev && label !== 'canvas') {
      const now = performance.now()
      if (now - lastPlayedAtRef.current >= PLATE_FOCUS_COOLDOWN_MS) {
        playPlateFocusSound(label)
        lastPlayedAtRef.current = now
      }
    }

    prevLabelRef.current = label
  }, [insideSpace, editingUi, nearPlateViewport, destination])
}

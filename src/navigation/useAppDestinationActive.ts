import { useCanvasStudioViewportZoneStore } from '../canvas/canvasStudioViewportZoneStore'
import { useUiCustomizationStore } from '../uiCustomization/uiCustomizationStore'
import { useAppDestinationStore, type AppDestination } from './appDestinationStore'

/** True when this destination label is shown on the Cutline brand pill. */
export function useAppDestinationActive(destination: AppDestination): boolean {
  const current = useAppDestinationStore((s) => s.destination)
  const nearPlateViewport = useCanvasStudioViewportZoneStore((s) => s.nearStudioViewport)
  const editingUi = useUiCustomizationStore((s) => s.editing)
  const atPlateViewport = editingUi || nearPlateViewport
  return atPlateViewport && current === destination
}

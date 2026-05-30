import { useCanvasStudioViewportZoneStore } from '../canvas/canvasStudioViewportZoneStore'
import { usePanMotionStore } from '../panMotionStore'
import { useUiCustomizationStore } from '../uiCustomization/uiCustomizationStore'
import { useAppDestinationStore, type AppDestination } from './appDestinationStore'

/** True when this destination label is shown on the Cutline brand pill. */
export function useAppDestinationActive(destination: AppDestination): boolean {
  const cameraFlying = usePanMotionStore((s) => s.cameraFlyActive)
  const current = useAppDestinationStore((s) => s.destination)
  const nearPlateViewport = useCanvasStudioViewportZoneStore((s) => s.nearStudioViewport)
  const viewportPlate = useCanvasStudioViewportZoneStore((s) => s.viewportPlate)
  const editingUi = useUiCustomizationStore((s) => s.editing)
  const atPlateViewport = editingUi || nearPlateViewport
  if (cameraFlying || !atPlateViewport) return false
  if (editingUi) return current === destination
  const activePlate = viewportPlate ?? current
  return activePlate === destination
}

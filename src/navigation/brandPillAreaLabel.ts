import type { AppDestination } from '../navigation/appDestinationStore'
import { useAppDestinationStore } from '../navigation/appDestinationStore'
import { useCanvasStudioViewportZoneStore } from '../canvas/canvasStudioViewportZoneStore'
import { useUiCustomizationStore } from '../uiCustomization/uiCustomizationStore'

export type BrandPillAreaLabel = AppDestination | 'canvas'

/** Matches the area name shown on the Cutline brand pill (TopBar). */
export function resolveBrandPillAreaLabel(): BrandPillAreaLabel {
  const nearPlateViewport = useCanvasStudioViewportZoneStore.getState().nearStudioViewport
  const editingUi = useUiCustomizationStore.getState().editing
  if (!editingUi && !nearPlateViewport) return 'canvas'
  return useAppDestinationStore.getState().destination
}

import {
  APP_DESTINATION_LABELS,
  useAppDestinationStore,
  type AppDestination,
} from '../navigation/appDestinationStore'
import { useCanvasStudioViewportZoneStore } from '../canvas/canvasStudioViewportZoneStore'
import { useUiCustomizationStore } from '../uiCustomization/uiCustomizationStore'

export type BrandPillAreaLabel = AppDestination | 'canvas'

function brandPillAreaLabelFromState(input: {
  nearStudioViewport: boolean
  viewportPlate: AppDestination | null
  destination: AppDestination
  editingUi: boolean
}): BrandPillAreaLabel {
  const { nearStudioViewport, viewportPlate, destination, editingUi } = input
  if (!editingUi && !nearStudioViewport) return 'canvas'
  if (viewportPlate) return viewportPlate
  return destination
}

/** Matches the area name shown on the Cutline brand pill (TopBar). */
export function resolveBrandPillAreaLabel(): BrandPillAreaLabel {
  return brandPillAreaLabelFromState({
    nearStudioViewport:
      useCanvasStudioViewportZoneStore.getState().nearStudioViewport,
    viewportPlate: useCanvasStudioViewportZoneStore.getState().viewportPlate,
    destination: useAppDestinationStore.getState().destination,
    editingUi: useUiCustomizationStore.getState().editing,
  })
}

/** Lowercase chrome copy beside “Cutline” on the brand pill. */
export function resolveBrandPillDestinationDisplay(): string {
  const area = resolveBrandPillAreaLabel()
  if (area === 'canvas') return 'canvas'
  return APP_DESTINATION_LABELS[area] ?? APP_DESTINATION_LABELS.studio
}

/** Reactive brand pill destination label for React components. */
export function useBrandPillDestinationDisplay(): string {
  const nearStudioViewport = useCanvasStudioViewportZoneStore(
    (s) => s.nearStudioViewport,
  )
  const viewportPlate = useCanvasStudioViewportZoneStore((s) => s.viewportPlate)
  const destination = useAppDestinationStore((s) => s.destination)
  const editingUi = useUiCustomizationStore((s) => s.editing)
  const area = brandPillAreaLabelFromState({
    nearStudioViewport,
    viewportPlate,
    destination,
    editingUi,
  })
  if (area === 'canvas') return 'canvas'
  return APP_DESTINATION_LABELS[area] ?? APP_DESTINATION_LABELS.studio
}

import { useUiCustomizationStore } from './uiCustomizationStore'

/** Subscribe to whether the UI customization edit mode is active. */
export function useUiEditingActive(): boolean {
  return useUiCustomizationStore((s) => s.editing)
}

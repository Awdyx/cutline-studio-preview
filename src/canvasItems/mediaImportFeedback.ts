import { TriangleAlert } from 'lucide-react'
import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'
import { MAX_MEDIA_BYTES } from './mediaUtils'

export type MediaImportFailure =
  | 'too_large'
  | 'unsupported'
  | 'processing_failed'
  | 'save_failed'

function formatMegabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1)
}

function messageFor(failure: MediaImportFailure, fileSize?: number): string {
  switch (failure) {
    case 'too_large':
      return typeof fileSize === 'number'
        ? `File too large (${formatMegabytes(fileSize)} MB) — max is ${formatMegabytes(MAX_MEDIA_BYTES)} MB`
        : `File too large — max is ${formatMegabytes(MAX_MEDIA_BYTES)} MB`
    case 'unsupported':
      return "Couldn't import that file type"
    case 'processing_failed':
      return "Couldn't process that image"
    case 'save_failed':
      return "Couldn't save that file"
  }
}

/** Defer one frame so native file pickers don't swallow the toast. */
export function showMediaImportToast(
  failure: MediaImportFailure,
  fileSize?: number,
): void {
  const payload = {
    shortcutId: `media-import-${failure}`,
    label: messageFor(failure, fileSize),
    keys: [] as string[],
    icon: TriangleAlert,
    holdMs: 3500,
  }

  requestAnimationFrame(() => {
    useShortcutUiStore.getState().showActionToast(payload)
  })
}

import { collectHistoryMediaIds } from '../canvasHistory/canvasHistory'
import {
  collectWorkspaceMediaIds,
  isWorkspaceHydrated,
} from '../spaces/canvasWorkspaceStore'
import { deleteMediaBlob, listMediaBlobIds } from './mediaBlobStore'

export function collectReferencedMediaIds(): Set<string> {
  const ids = new Set<string>()
  for (const id of collectHistoryMediaIds()) ids.add(id)
  for (const id of collectWorkspaceMediaIds()) ids.add(id)
  return ids
}

export async function gcUnreferencedMediaBlobs(): Promise<void> {
  if (!isWorkspaceHydrated()) return

  const referenced = collectReferencedMediaIds()
  const stored = await listMediaBlobIds()
  await Promise.all(
    stored
      .filter((mediaId) => !referenced.has(mediaId))
      .map((mediaId) => deleteMediaBlob(mediaId)),
  )
}

let gcTimer: ReturnType<typeof setTimeout> | null = null

/** Debounced — only runs after workspace hydrate; use after explicit deletes. */
export function scheduleMediaBlobGc(): void {
  if (!isWorkspaceHydrated()) return
  if (gcTimer !== null) clearTimeout(gcTimer)
  gcTimer = setTimeout(() => {
    gcTimer = null
    void gcUnreferencedMediaBlobs()
  }, 400)
}

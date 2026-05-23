import { CANVAS_ITEMS_STORAGE_KEY, loadCanvasItemsFromStorage } from '../canvasItems/canvasItemsPersistence'
import type { CanvasItem } from '../canvasItems/types'
import type { LoadedWorkspace } from '../spaces/workspacePersistence'
import { tryRecoverMediaBlob } from './tryRecoverMediaBlob'
import {
  putSnapshotFromDataUrl,
  verifySnapshotBlob,
} from './mediaBlobStore'
import { buildLegacyMediaSrcIndex } from './legacyMediaSrcIndex'
import { isInlineDataUrl } from './mediaKeys'

async function recoverMediaItem(
  item: CanvasItem,
): Promise<boolean> {
  if (item.type !== 'image' && item.type !== 'video') return false
  return tryRecoverMediaBlob(item.mediaId, item.id)
}

async function recoverItems(
  items: CanvasItem[],
): Promise<{ items: CanvasItem[]; recovered: number }> {
  let recovered = 0
  const next: CanvasItem[] = []
  for (const item of items) {
    if (await recoverMediaItem(item)) recovered++
    next.push(item)
  }
  return { items: next, recovered }
}

function mergeMissingMainMediaItems(
  mainItems: CanvasItem[],
  legacyItems: CanvasItem[],
): { items: CanvasItem[]; merged: number } {
  const existing = new Set(mainItems.map((item) => item.id))
  const missing = legacyItems.filter(
    (item) =>
      (item.type === 'image' || item.type === 'video') && !existing.has(item.id),
  )
  if (missing.length === 0) return { items: mainItems, merged: 0 }
  return { items: [...mainItems, ...missing], merged: missing.length }
}

async function recoverSpaceSnapshot(
  spaceId: string,
  snapshotId: string | null,
  legacySrc: Map<string, string>,
): Promise<boolean> {
  if (!snapshotId) return false
  if (await verifySnapshotBlob(snapshotId)) return false

  const src = legacySrc.get(snapshotId) ?? legacySrc.get(spaceId)
  if (!src || !isInlineDataUrl(src)) return false

  const saved = await putSnapshotFromDataUrl(snapshotId, src)
  return saved && (await verifySnapshotBlob(snapshotId))
}

/** Rehydrate IndexedDB blobs from backups / legacy inline data URLs when blobs were lost. */
export async function recoverMissingWorkspaceMedia(
  data: LoadedWorkspace,
): Promise<{ workspace: LoadedWorkspace; recoveredCount: number }> {
  const legacySrc = buildLegacyMediaSrcIndex()
  const legacyItems = loadCanvasItemsFromStorage()
  let recoveredCount = 0

  const mergedMain = mergeMissingMainMediaItems(data.mainItems, legacyItems)
  if (mergedMain.merged > 0) {
    recoveredCount += mergedMain.merged
    console.info(
      `[media] restored ${mergedMain.merged} missing media item(s) from legacy canvas storage`,
    )
  }

  const main = await recoverItems(mergedMain.items)
  recoveredCount += main.recovered

  const spaces: LoadedWorkspace['spaces'] = {}
  for (const [spaceId, space] of Object.entries(data.spaces)) {
    const items = await recoverItems(space.items)
    recoveredCount += items.recovered
    if (await recoverSpaceSnapshot(spaceId, space.snapshotId, legacySrc)) {
      recoveredCount++
    }
    spaces[spaceId] = { ...space, items: items.items }
  }

  if (main.recovered > 0) {
    console.info(
      `[media] recovered ${main.recovered} missing blob(s) during workspace hydrate`,
    )
  }

  return {
    workspace: {
      ...data,
      mainItems: main.items,
      spaces,
    },
    recoveredCount,
  }
}

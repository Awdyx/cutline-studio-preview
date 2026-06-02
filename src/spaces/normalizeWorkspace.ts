import type { CanvasItem } from '../canvasItems/types'
import { resolveItemTextAlignment } from '../canvasItems/textAlignment'
import { ensureStrokePaths } from '../drawing/strokePaths'
import {
  WORKSPACE_STORAGE_VERSION,
  type LoadedWorkspace,
} from './workspacePersistence'
import { resetWorkspacePocketsForStripV4 } from './pocketReset'
import { defaultPocketStripState } from './pocketStripDimensions'
import { clampStripScrollY } from './spacePreviewPan'

function normalizeCanvasItem(item: CanvasItem): CanvasItem {
  if (item.type === 'sticky') {
    return {
      ...item,
      textAlign: resolveItemTextAlignment(item),
      strokes: ensureStrokePaths(item.strokes),
      ...(item.annotationStrokes
        ? { annotationStrokes: ensureStrokePaths(item.annotationStrokes) }
        : {}),
    }
  }

  if (item.type === 'text' || item.type === 'space') {
    return {
      ...item,
      textAlign: resolveItemTextAlignment(item),
    }
  }

  return item
}

function stripLegacyPreviewPan(item: CanvasItem): CanvasItem {
  if (item.type !== 'space' || !('previewPan' in item)) return item
  const { previewPan: _legacy, ...rest } = item as CanvasItem & {
    previewPan?: unknown
  }
  return rest as CanvasItem
}

/** Copy legacy card previewPan.y into strip.scrollY when scroll was never saved. */
function migrateLegacyPreviewPanToStripScroll(
  mainItems: CanvasItem[],
  spaces: LoadedWorkspace['spaces'],
): LoadedWorkspace['spaces'] {
  const next = { ...spaces }

  for (const item of mainItems) {
    if (item.type !== 'space') continue
    const space = next[item.id]
    if (!space) continue

    const scrollY = space.strip?.scrollY ?? 0
    if (scrollY !== 0) continue

    const legacyPan = (item as CanvasItem & { previewPan?: { y?: unknown } })
      .previewPan
    const legacyY = legacyPan?.y
    if (typeof legacyY !== 'number' || !Number.isFinite(legacyY) || legacyY === 0) {
      continue
    }

    const strip = space.strip ?? defaultPocketStripState()
    next[item.id] = {
      ...space,
      strip: {
        ...strip,
        // previewPan.y was inverted vs pocket strip scroll (card center = -pan.y).
        scrollY: clampStripScrollY(-legacyY, strip.logicalWidth),
      },
    }
  }

  return next
}

/** Precompute stroke paths and normalize items before they hit React render. */
export function normalizeLoadedWorkspace(loaded: LoadedWorkspace): LoadedWorkspace {
  const base =
    loaded.storageVersion < WORKSPACE_STORAGE_VERSION
      ? resetWorkspacePocketsForStripV4(loaded)
      : loaded

  const spacesWithScroll = migrateLegacyPreviewPanToStripScroll(
    base.mainItems,
    base.spaces,
  )

  const spaces: LoadedWorkspace['spaces'] = {}
  for (const [id, space] of Object.entries(spacesWithScroll)) {
    spaces[id] = {
      ...space,
      strip: space.strip ?? defaultPocketStripState(),
      items: space.items.map(normalizeCanvasItem),
      strokes: ensureStrokePaths(space.strokes),
      annotationStrokes: ensureStrokePaths(space.annotationStrokes),
    }
  }

  return {
    ...base,
    mainItems: base.mainItems.map(normalizeCanvasItem).map(stripLegacyPreviewPan),
    mainStrokes: ensureStrokePaths(base.mainStrokes),
    mainAnnotationStrokes: ensureStrokePaths(base.mainAnnotationStrokes),
    spaces,
  }
}

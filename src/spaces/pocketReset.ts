import type { CanvasItem } from '../canvasItems/types'
import { defaultPocketStripState } from './pocketStripDimensions'
import type { LoadedWorkspace } from './workspacePersistence'
import type { SpaceCanvasData } from './types'

/** Wipe pocket interiors — keep pocket names and main-canvas space widgets only. */
export function resetWorkspacePocketsForStripV4(
  loaded: LoadedWorkspace,
): LoadedWorkspace {
  const spaces: Record<string, SpaceCanvasData> = {}
  for (const [id, space] of Object.entries(loaded.spaces)) {
    spaces[id] = {
      name: space.name,
      items: [],
      strokes: [],
      annotationStrokes: [],
      snapshotId: null,
      strip: defaultPocketStripState(),
    }
  }

  const mainItems = loaded.mainItems.map((item): CanvasItem =>
    item.type === 'space' ? { ...item, snapshotId: null } : item,
  )

  return {
    ...loaded,
    mainItems,
    spaces,
    activeCanvasId: 'main',
    storageVersion: 4,
  }
}

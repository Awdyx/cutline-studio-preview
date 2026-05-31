import {
  APP_DESTINATION_LABELS,
  useAppDestinationStore,
} from '../navigation/appDestinationStore'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import {
  DEFAULT_SPACE_NAME,
  DEFAULT_SPACE_NAME_PLACEHOLDER,
  isDefaultSpaceName,
} from '../spaces/types'

export type ReloadIntroCopy = {
  name: string
  suffix: string
}

const STUDIO_SUFFIX = '<3'

/** Title copy for the reload intro — last focused main-canvas plate, or pocket name. */
export function resolveReloadIntroCopy(): ReloadIntroCopy {
  const { activeCanvasId, spaces } = useCanvasWorkspaceStore.getState()

  if (activeCanvasId !== 'main') {
    const raw = spaces[activeCanvasId]?.name ?? DEFAULT_SPACE_NAME
    const name = isDefaultSpaceName(raw) ? DEFAULT_SPACE_NAME_PLACEHOLDER : raw.trim()
    return { name, suffix: STUDIO_SUFFIX }
  }

  const destination = useAppDestinationStore.getState().destination

  return {
    name: APP_DESTINATION_LABELS[destination],
    suffix: STUDIO_SUFFIX,
  }
}

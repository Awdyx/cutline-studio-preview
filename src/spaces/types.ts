import type { CanvasItem } from '../canvasItems/types'
import type { Stroke } from '../drawing/types'

export type ActiveCanvasId = 'main' | string

export type SpaceCamera = {
  positionX: number
  positionY: number
  scale: number
}

export type SpaceCanvasData = {
  items: CanvasItem[]
  strokes: Stroke[]
  annotationStrokes: Stroke[]
  name: string
  snapshotId: string | null
  camera: SpaceCamera
}

export const DEFAULT_SPACE_NAME = 'Untitled pocket'
/** Lowercase placeholder shown when the default name is still in use. */
export const DEFAULT_SPACE_NAME_PLACEHOLDER = 'untitled pocket'
const LEGACY_DEFAULT_SPACE_NAME = 'Untitled space'
export const SPACE_NAME_MAX_LENGTH = 25

export function isDefaultSpaceName(name: string): boolean {
  const normalized = name.trim().toLowerCase()
  return (
    normalized === DEFAULT_SPACE_NAME.toLowerCase() ||
    normalized === LEGACY_DEFAULT_SPACE_NAME.toLowerCase() ||
    normalized === DEFAULT_SPACE_NAME_PLACEHOLDER ||
    normalized === 'untitled space'
  )
}

export function clampSpaceName(name: string): string {
  return name.slice(0, SPACE_NAME_MAX_LENGTH)
}

export const DEFAULT_SPACE_CAMERA: SpaceCamera = {
  positionX: 0,
  positionY: 0,
  scale: 1,
}

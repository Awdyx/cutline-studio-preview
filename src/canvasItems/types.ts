import type { CanvasLayer } from '../canvasLock/layer'
import type { Stroke } from '../drawing/types'
import type { ItemTextAlignment } from './textAlignment'
import type { SpacePreviewPan } from '../spaces/spacePreviewPan'
import { DEFAULT_SPACE_NAME_ALIGNMENT, DEFAULT_TEXT_ALIGNMENT } from './textAlignment'

export type { ItemTextAlignment, TextAlignH, TextAlignV } from './textAlignment'
export { DEFAULT_TEXT_ALIGNMENT, DEFAULT_SPACE_NAME_ALIGNMENT }
export type { CanvasLayer } from '../canvasLock/layer'

export type CanvasItemType = 'sticky' | 'text' | 'image' | 'video' | 'space'

export type CanvasItemBase = {
  id: string
  type: CanvasItemType
  x: number
  y: number
  zIndex: number
  width: number
  height: number
  /** Omitted or `committed` = permanent canvas content; `annotation` = added while locked. */
  layer?: CanvasLayer
}

export type StickyCanvasItem = CanvasItemBase & {
  type: 'sticky'
  text: string
  strokes: Stroke[]
  /** Ink on top of a committed sticky while the canvas is locked. */
  annotationStrokes?: Stroke[]
  textAlign: ItemTextAlignment
}

export type TextCanvasItem = CanvasItemBase & {
  type: 'text'
  text: string
  textAlign: ItemTextAlignment
}

export type ImageCanvasItem = CanvasItemBase & {
  type: 'image'
  /** IndexedDB blob id — same as item id for new imports. */
  mediaId: string
  /** Display size at import — used to restore aspect ratio after resize. */
  importWidth?: number
  importHeight?: number
}

export type VideoCanvasItem = CanvasItemBase & {
  type: 'video'
  mediaId: string
  importWidth?: number
  importHeight?: number
}

export type SpaceCanvasItem = CanvasItemBase & {
  type: 'space'
  name: string
  textAlign: ItemTextAlignment
  /** IndexedDB snapshot blob id — typically the space id. */
  snapshotId: string | null
  /** Pan offset for the card preview viewport. */
  previewPan?: SpacePreviewPan
}

export type CanvasItem =
  | StickyCanvasItem
  | TextCanvasItem
  | ImageCanvasItem
  | VideoCanvasItem
  | SpaceCanvasItem

export const STICKY_WIDTH = 200
export const STICKY_HEIGHT = 200

export const SPACE_WIDTH = 240
export const SPACE_HEIGHT = 240
export const MAX_SPACE_WIDGETS = 3
export const TEXT_WIDTH = 320
export const TEXT_HEIGHT = 72
export const TEXT_MIN_WIDTH = 120
export const TEXT_MIN_HEIGHT = 48
/** Muted yellow — slightly desaturated vs classic sticky note. */
export const STICKY_COLOR = '#F0EBC6'

/** Imported images/videos: 20% saturation reduction (saturate(0.8)). */
export const MEDIA_SATURATE = 0.8

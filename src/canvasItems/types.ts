import type { CanvasLayer } from '../canvasLock/layer'
import type { Stroke } from '../drawing/types'
import type { ItemTextAlignment } from './textAlignment'
import type { SpacePreviewPan } from '../spaces/spacePreviewPan'
import { DEFAULT_SPACE_NAME_ALIGNMENT, DEFAULT_TEXT_ALIGNMENT } from './textAlignment'

export type { ItemTextAlignment, TextAlignH, TextAlignV } from './textAlignment'
export { DEFAULT_TEXT_ALIGNMENT, DEFAULT_SPACE_NAME_ALIGNMENT }
export type { CanvasLayer } from '../canvasLock/layer'

export type CanvasItemType = 'sticky' | 'text' | 'image' | 'video' | 'space' | 'study_hub'

export type StudySubjectId = 'hubs' | 'cels' | 'phsi' | 'chem'

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
  /** Main-canvas position before transfer into a space — restored on send-back. */
  mainCanvasOrigin?: {
    x: number
    y: number
    zIndex: number
  }
}

export type StickyColorId = 'yellow' | 'pink' | 'blue'

export type StickyCanvasItem = CanvasItemBase & {
  type: 'sticky'
  text: string
  strokes: Stroke[]
  /** Ink on top of a committed sticky while the canvas is locked. */
  annotationStrokes?: Stroke[]
  textAlign: ItemTextAlignment
  /** Background color preset — omitted means default yellow. */
  color?: StickyColorId
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
  /** When set, x/y are local to the sticky interior (top-left origin). */
  stickyId?: string
}

/** Image clipped inside a sticky — x/y are sticky-local coordinates. */
export function isImageInSticky(
  item: CanvasItem | undefined,
): item is ImageCanvasItem & { stickyId: string } {
  return item?.type === 'image' && typeof item.stickyId === 'string'
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

export type StudyHubCanvasItem = CanvasItemBase & {
  type: 'study_hub'
  subjectId: StudySubjectId
  strokes: Stroke[]
  /** Ink on top of a committed study hub while the canvas is locked. */
  annotationStrokes?: Stroke[]
  /** Canvas zoom when spawned — keeps on-screen size stable while panning/zooming. */
  spawnScale?: number
}

export type DrawableSurfaceItem = StickyCanvasItem | StudyHubCanvasItem

/** Pen ink clipped to item bounds — stickies only. */
export function isStickyItem(item: CanvasItem): item is StickyCanvasItem {
  return item.type === 'sticky'
}

/** Ink on a sticky — same stroke sources rendered by StickyStrokesSvg. */
export function stickyHasInk(
  sticky: StickyCanvasItem,
  activeStroke?: Stroke | null,
): boolean {
  if (sticky.strokes.length > 0) return true
  if ((sticky.annotationStrokes?.length ?? 0) > 0) return true
  return activeStroke != null && activeStroke.points.length > 0
}

export function isDrawableSurface(item: CanvasItem): item is DrawableSurfaceItem {
  return item.type === 'sticky' || item.type === 'study_hub'
}

export type CanvasItem =
  | StickyCanvasItem
  | TextCanvasItem
  | ImageCanvasItem
  | VideoCanvasItem
  | SpaceCanvasItem
  | StudyHubCanvasItem

/** Cumulative spawn footprint vs original design (×1.3, then +20%). */
export const STUDIO_SPAWN_SIZE_SCALE = 1.3 * 1.2

export const STICKY_WIDTH = Math.round(200 * STUDIO_SPAWN_SIZE_SCALE)
export const STICKY_HEIGHT = Math.round(200 * STUDIO_SPAWN_SIZE_SCALE)
/** Inner text inset for sticky editors and empty hint. */
export const STICKY_TEXT_INSET = Math.round(14 * STUDIO_SPAWN_SIZE_SCALE)

export const SPACE_WIDTH = Math.round(240 * STUDIO_SPAWN_SIZE_SCALE)
export const SPACE_HEIGHT = Math.round(240 * STUDIO_SPAWN_SIZE_SCALE)
export const MAX_SPACE_WIDGETS = 4
/** Initial spawn size — grows to fit content while editing. */
export const TEXT_BOX_INSET_X = Math.round(15 * STUDIO_SPAWN_SIZE_SCALE)
export const TEXT_BOX_INSET_Y = Math.round(15 * STUDIO_SPAWN_SIZE_SCALE)
/** Minimum outer box — inset plus empty caret / one text line. */
export const TEXT_MIN_WIDTH = TEXT_BOX_INSET_X * 2 + 2
export const TEXT_MIN_HEIGHT =
  TEXT_BOX_INSET_Y * 2 + Math.round(24 * STUDIO_SPAWN_SIZE_SCALE)
/** Comfortable starting rectangle when spawning new text from the menu. */
export const TEXT_WIDTH = Math.round(320 * STUDIO_SPAWN_SIZE_SCALE)
export const TEXT_HEIGHT = Math.round(120 * STUDIO_SPAWN_SIZE_SCALE)
/** Max width while auto-fitting content during the first edit. */
export const TEXT_MAX_AUTO_WIDTH = Math.round(320 * STUDIO_SPAWN_SIZE_SCALE)
export const TEXT_BOX_PADDING = `${TEXT_BOX_INSET_Y}px ${TEXT_BOX_INSET_X}px`
export const STUDY_HUB_WIDTH = 460
export const STUDY_HUB_HEIGHT = 580
export const STUDY_HUB_ASPECT = STUDY_HUB_WIDTH / STUDY_HUB_HEIGHT
/** Muted yellow — slightly desaturated vs classic sticky note. */
export const STICKY_COLOR = '#F0EBC6'

/** Imported images/videos: 20% saturation reduction (saturate(0.8)). */
export const MEDIA_SATURATE = 0.8

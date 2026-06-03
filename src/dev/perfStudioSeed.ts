import {
  CANVAS_CONTENT_OFFSET_X,
  CANVAS_CONTENT_OFFSET_Y,
  CANVAS_ORIGINAL_HEIGHT,
  CANVAS_ORIGINAL_WIDTH,
} from '../drawing/canvasDimensions'
import { putMediaBlob } from '../media/mediaBlobStore'
import { DEFAULT_SPACE_NAME } from '../spaces/types'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import { generateItemId } from '../canvasItems/itemId'
import { studyHubSpawnDimensions } from '../canvasItems/studyHubBounds'
import type {
  CanvasItem,
  ImageCanvasItem,
  SpaceCanvasItem,
  StickyCanvasItem,
  StudyHubCanvasItem,
  StudySubjectId,
  TextCanvasItem,
  VideoCanvasItem,
} from '../canvasItems/types'
import {
  DEFAULT_TEXT_ALIGNMENT,
  DEFAULT_SPACE_NAME_ALIGNMENT,
  SPACE_HEIGHT,
  SPACE_WIDTH,
  STICKY_HEIGHT,
  STICKY_WIDTH,
  TEXT_HEIGHT,
  TEXT_WIDTH,
} from '../canvasItems/types'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { useStrokesStore } from '../drawing/strokesStore'
import { clearHistory } from '../canvasHistory/canvasHistory'

const STUDY_SUBJECTS: StudySubjectId[] = ['hubs', 'cels', 'phsi', 'chem']
const MEDIA_W = 180
const MEDIA_H = 135

export type PerfSeedOptions = {
  /** Copies of sticky, text, image, and video (default 12 each). */
  perType?: number
  /** Include up to 4 space widgets (default true). */
  spaces?: boolean
  /** Include one study hub per subject (default true). */
  studyHubs?: boolean
  /** Replace all canvas items and strokes (default true). */
  reset?: boolean
}

export type PerfSeedResult = {
  added: Record<string, number>
  total: number
  ms: number
}

async function placeholderImageBlob(hue: number): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = MEDIA_W
  canvas.height = MEDIA_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  ctx.fillStyle = `hsl(${hue}, 42%, 62%)`
  ctx.fillRect(0, 0, MEDIA_W, MEDIA_H)
  ctx.strokeStyle = 'rgba(20, 30, 50, 0.18)'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, MEDIA_W - 2, MEDIA_H - 2)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/webp',
      0.85,
    )
  })
}

function gridPoint(index: number, cols: number, cellW: number, cellH: number, pad: number) {
  const col = index % cols
  const row = Math.floor(index / cols)
  const x =
    CANVAS_CONTENT_OFFSET_X +
    pad +
    col * cellW +
    cellW / 2
  const y =
    CANVAS_CONTENT_OFFSET_Y +
    pad +
    row * cellH +
    cellH / 2
  return { x, y }
}

export async function seedPerfStudioItems(
  opts: PerfSeedOptions = {},
): Promise<PerfSeedResult> {
  const perType = Math.max(1, opts.perType ?? 12)
  const includeSpaces = opts.spaces !== false
  const includeStudyHubs = opts.studyHubs !== false
  const reset = opts.reset !== false

  const t0 = performance.now()

  if (reset) {
    useStrokesStore.setState({ strokes: [], annotationStrokes: [] })
    useCanvasItemsStore.setState({
      items: [],
      selectedIds: [],
      pendingEditorFocusId: null,
    })
    clearHistory()
  }

  const sharedMediaId = generateItemId()
  const sharedBlob = await placeholderImageBlob(210)
  await putMediaBlob(sharedMediaId, sharedBlob)

  const items: CanvasItem[] = []
  let z = 1
  const nextZIndex = () => z++
  const pad = 48
  const cols = 6
  const cellW = Math.max(STICKY_WIDTH, TEXT_WIDTH, MEDIA_W) + 28
  const cellH = Math.max(STICKY_HEIGHT, TEXT_HEIGHT, MEDIA_H) + 28

  for (let i = 0; i < perType; i++) {
    const { x, y } = gridPoint(i, cols, cellW, cellH, pad)
    const sticky: StickyCanvasItem = {
      id: generateItemId(),
      type: 'sticky',
      x: x - STICKY_WIDTH / 2,
      y: y - STICKY_HEIGHT / 2,
      width: STICKY_WIDTH,
      height: STICKY_HEIGHT,
      zIndex: nextZIndex(),
      text: `Perf sticky ${i + 1}`,
      strokes: [],
      textAlign: DEFAULT_TEXT_ALIGNMENT,
      color: (['yellow', 'pink', 'blue', 'green'] as const)[i % 4],
    }
    items.push(sticky)
  }

  for (let i = 0; i < perType; i++) {
    const { x, y } = gridPoint(perType + i, cols, cellW, cellH, pad)
    const text: TextCanvasItem = {
      id: generateItemId(),
      type: 'text',
      x: x - TEXT_WIDTH / 2,
      y: y - TEXT_HEIGHT / 2,
      width: TEXT_WIDTH,
      height: TEXT_HEIGHT,
      zIndex: nextZIndex(),
      text: `Perf text ${i + 1}`,
      textAlign: DEFAULT_TEXT_ALIGNMENT,
    }
    items.push(text)
  }

  for (let i = 0; i < perType; i++) {
    const { x, y } = gridPoint(perType * 2 + i, cols, cellW, cellH, pad)
    const mediaId = i === 0 ? sharedMediaId : generateItemId()
    if (i > 0) await putMediaBlob(mediaId, sharedBlob)
    const image: ImageCanvasItem = {
      id: generateItemId(),
      type: 'image',
      x: x - MEDIA_W / 2,
      y: y - MEDIA_H / 2,
      width: MEDIA_W,
      height: MEDIA_H,
      zIndex: nextZIndex(),
      mediaId,
      importWidth: MEDIA_W,
      importHeight: MEDIA_H,
    }
    items.push(image)
  }

  for (let i = 0; i < perType; i++) {
    const { x, y } = gridPoint(perType * 3 + i, cols, cellW, cellH, pad)
    const mediaId = generateItemId()
    await putMediaBlob(mediaId, sharedBlob)
    const video: VideoCanvasItem = {
      id: generateItemId(),
      type: 'video',
      x: x - MEDIA_W / 2,
      y: y - MEDIA_H / 2,
      width: MEDIA_W,
      height: MEDIA_H,
      zIndex: nextZIndex(),
      mediaId,
      importWidth: MEDIA_W,
      importHeight: MEDIA_H,
    }
    items.push(video)
  }

  if (includeSpaces) {
    for (let i = 0; i < 4; i++) {
      const { x, y } = gridPoint(perType * 4 + i, cols, cellW, cellH, pad)
      const id = generateItemId()
      const space: SpaceCanvasItem = {
        id,
        type: 'space',
        x: x - SPACE_WIDTH / 2,
        y: y - SPACE_HEIGHT / 2,
        width: SPACE_WIDTH,
        height: SPACE_HEIGHT,
        zIndex: nextZIndex(),
        name: `${DEFAULT_SPACE_NAME} ${i + 1}`,
        snapshotId: null,
        textAlign: DEFAULT_SPACE_NAME_ALIGNMENT,
      }
      items.push(space)
      useCanvasWorkspaceStore.getState().addSpaceData(id, `${DEFAULT_SPACE_NAME} ${i + 1}`, {
        persist: false,
      })
    }
  }

  if (includeStudyHubs) {
    const { width, height } = studyHubSpawnDimensions(1)
    STUDY_SUBJECTS.forEach((subjectId, i) => {
      const { x, y } = gridPoint(perType * 4 + 4 + i, cols, cellW, cellH, pad)
      const hub: StudyHubCanvasItem = {
        id: generateItemId(),
        type: 'study_hub',
        x: x - width / 2,
        y: y - height / 2,
        width,
        height,
        zIndex: nextZIndex(),
        subjectId,
        strokes: [],
        annotationStrokes: [],
        spawnScale: 1,
      }
      items.push(hub)
    })
  }

  useCanvasItemsStore.setState({
    items,
    selectedIds: [],
    pendingEditorFocusId: null,
  })

  const ms = performance.now() - t0
  const added = {
    sticky: perType,
    text: perType,
    image: perType,
    video: perType,
    space: includeSpaces ? 4 : 0,
    study_hub: includeStudyHubs ? STUDY_SUBJECTS.length : 0,
  }

  return {
    added,
    total: Object.values(added).reduce((a, b) => a + b, 0),
    ms,
  }
}

export function clearPerfStudioItems(): void {
  useStrokesStore.setState({ strokes: [], annotationStrokes: [] })
  useCanvasItemsStore.setState({
    items: [],
    selectedIds: [],
    pendingEditorFocusId: null,
  })
  clearHistory()
}

/** Studio plate centre in full-canvas coordinates. */
export function perfStudioFocusPoint(): { x: number; y: number } {
  return {
    x: CANVAS_CONTENT_OFFSET_X + CANVAS_ORIGINAL_WIDTH / 2,
    y: CANVAS_CONTENT_OFFSET_Y + CANVAS_ORIGINAL_HEIGHT / 2,
  }
}

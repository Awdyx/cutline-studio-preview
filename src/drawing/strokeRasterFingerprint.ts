import { useStrokesStore } from './strokesStore'
import { useThemeStore } from '../theme/themeStore'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'

/** Cheap cache key — rebuild bitmaps when strokes, theme, or canvas changes. */
export function readStrokeRasterFingerprint(): string {
  const { strokes, annotationStrokes } = useStrokesStore.getState()
  const theme = useThemeStore.getState().mode
  const canvasId = useCanvasWorkspaceStore.getState().activeCanvasId

  const strokeSig = strokes.map((s) => `${s.id}:${s.path?.length ?? s.points.length}`).join('|')
  const annSig = annotationStrokes
    .map((s) => `${s.id}:${s.path?.length ?? s.points.length}`)
    .join('|')

  return `${canvasId}:${theme}:${strokeSig}::${annSig}`
}

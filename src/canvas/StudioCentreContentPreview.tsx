import { useMemo } from 'react'
import { resolveStrokeFill } from '../drawing/colorUtils'
import { CANVAS_ORIGINAL_HEIGHT, CANVAS_ORIGINAL_WIDTH } from '../drawing/canvasDimensions'
import type { Stroke } from '../drawing/types'
import { canvasBackgroundColor } from '../theme/paletteGenerator'
import { useThemeStore } from '../theme/themeStore'
import { useEffectiveMode } from '../theme/useEffectiveMode'
import type { CanvasItem } from '../canvasItems/types'
import { PreviewMediaImage } from '../canvasItems/PreviewMediaImage'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { useStrokesStore } from '../drawing/strokesStore'
import {
  PreviewStickyItem,
  PreviewStudyHubItem,
  PreviewTextItem,
} from '../spaces/spacePreviewItems'

function StrokePaths({
  strokes,
  effectiveMode,
  keyPrefix,
}: {
  strokes: Stroke[]
  effectiveMode: 'light' | 'dark'
  keyPrefix: string
}) {
  return strokes.map((stroke) => {
    if (!stroke.path) return null
    return (
      <path
        key={`${keyPrefix}-${stroke.id}`}
        d={stroke.path}
        fill={resolveStrokeFill(stroke.color, stroke.tool, effectiveMode)}
      />
    )
  })
}

function PreviewItem({
  item,
  effectiveMode,
}: {
  item: CanvasItem
  effectiveMode: 'light' | 'dark'
}) {
  if (item.type === 'sticky') {
    return <PreviewStickyItem item={item} effectiveMode={effectiveMode} />
  }

  if (item.type === 'image' || item.type === 'video') {
    return (
      <PreviewMediaImage
        mediaId={item.mediaId}
        x={item.x}
        y={item.y}
        width={item.width}
        height={item.height}
        opacity={item.type === 'video' ? 0.92 : 1}
      />
    )
  }

  if (item.type === 'text') {
    return <PreviewTextItem item={item} />
  }

  if (item.type === 'study_hub') {
    return <PreviewStudyHubItem item={item} effectiveMode={effectiveMode} />
  }

  return null
}

/** Live miniature of the main studio-centre canvas contents. */
export default function StudioCentreContentPreview({
  className,
}: {
  className?: string
}) {
  const items = useCanvasItemsStore((s) => s.items)
  const strokes = useStrokesStore((s) => s.strokes)
  const annotationStrokes = useStrokesStore((s) => s.annotationStrokes)
  const palette = useThemeStore((s) => s.palette)
  const themeMode = useThemeStore((s) => s.mode)
  const effectiveMode = useEffectiveMode(themeMode)

  const sortedItems = useMemo(
    () =>
      [...items]
        .filter((item) => item.type !== 'space')
        .sort((a, b) => a.zIndex - b.zIndex),
    [items],
  )

  const bg = canvasBackgroundColor(palette, effectiveMode)

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: bg,
        overflow: 'hidden',
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${CANVAS_ORIGINAL_WIDTH} ${CANVAS_ORIGINAL_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
        style={{ display: 'block' }}
      >
        <StrokePaths strokes={strokes} effectiveMode={effectiveMode} keyPrefix="c" />
        <StrokePaths
          strokes={annotationStrokes}
          effectiveMode={effectiveMode}
          keyPrefix="ann"
        />
        {sortedItems.map((item) => (
          <PreviewItem key={item.id} item={item} effectiveMode={effectiveMode} />
        ))}
      </svg>
      <div className="space-preview-vignette" aria-hidden />
    </div>
  )
}

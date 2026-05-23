import { useMemo } from 'react'
import { resolveStrokeFill } from '../drawing/colorUtils'
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../drawing/canvasDimensions'
import type { Stroke } from '../drawing/types'
import {
  canvasBackgroundColor,
  resolveStickyColor,
} from '../theme/paletteGenerator'
import { useThemeStore } from '../theme/themeStore'
import { useEffectiveMode } from '../theme/useEffectiveMode'
import type { CanvasItem } from '../canvasItems/types'
import { PreviewMediaImage } from '../canvasItems/PreviewMediaImage'
import { useCanvasWorkspaceStore } from './canvasWorkspaceStore'
import { resolveSpacePreviewPan, previewTransform, type SpacePreviewPan } from './spacePreviewPan'

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
    return (
      <g>
        <rect
          x={item.x}
          y={item.y}
          width={item.width}
          height={item.height}
          rx={4}
          fill={resolveStickyColor(effectiveMode)}
        />
        <StrokePaths
          strokes={item.strokes}
          effectiveMode={effectiveMode}
          keyPrefix={`${item.id}-s`}
        />
        <StrokePaths
          strokes={item.annotationStrokes ?? []}
          effectiveMode={effectiveMode}
          keyPrefix={`${item.id}-a`}
        />
      </g>
    )
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
    return (
      <rect
        x={item.x}
        y={item.y}
        width={item.width}
        height={item.height}
        rx={3}
        fill={effectiveMode === 'light' ? 'rgba(30, 35, 45, 0.06)' : 'rgba(255, 255, 255, 0.08)'}
      />
    )
  }

  return null
}

export default function SpaceCardPreview({
  spaceId,
  previewPan,
}: {
  spaceId: string
  previewPan?: SpacePreviewPan
}) {
  const space = useCanvasWorkspaceStore((s) => s.spaces[spaceId])
  const palette = useThemeStore((s) => s.palette)
  const themeMode = useThemeStore((s) => s.mode)
  const effectiveMode = useEffectiveMode(themeMode)
  const view = resolveSpacePreviewPan(previewPan)

  const sortedItems = useMemo(
    () => [...(space?.items ?? [])].sort((a, b) => a.zIndex - b.zIndex),
    [space?.items],
  )

  if (!space) return null

  const bg = canvasBackgroundColor(palette, effectiveMode)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: bg,
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
        style={{ display: 'block' }}
      >
        <g transform={previewTransform(view)}>
          <StrokePaths
            strokes={space.strokes}
            effectiveMode={effectiveMode}
            keyPrefix="c"
          />
          <StrokePaths
            strokes={space.annotationStrokes}
            effectiveMode={effectiveMode}
            keyPrefix="ann"
          />
          {sortedItems.map((item) => (
            <PreviewItem key={item.id} item={item} effectiveMode={effectiveMode} />
          ))}
        </g>
      </svg>
    </div>
  )
}

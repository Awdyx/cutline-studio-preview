import { useMemo } from 'react'
import { resolveStrokeFill } from '../drawing/colorUtils'
import type { Stroke } from '../drawing/types'
import { canvasBackgroundColor } from '../theme/paletteGenerator'
import { useThemeStore } from '../theme/themeStore'
import { useEffectiveMode } from '../theme/useEffectiveMode'
import type { CanvasItem } from '../canvasItems/types'
import { PreviewMediaImage } from '../canvasItems/PreviewMediaImage'
import { useCanvasWorkspaceStore } from './canvasWorkspaceStore'
import { useSpaceDropStore } from './spaceDropStore'
import {
  PreviewStickyItem,
  PreviewStudyHubItem,
  PreviewTextItem,
} from './spacePreviewItems'
import {
  previewLogicalWidth,
  previewStripViewBox,
  previewTransform,
  previewViewFromStripScroll,
} from './spacePreviewPan'

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
  ghost,
}: {
  item: CanvasItem
  effectiveMode: 'light' | 'dark'
  ghost?: boolean
}) {
  const opacity = ghost ? 0.52 : 1

  if (item.type === 'sticky') {
    return (
      <PreviewStickyItem
        item={item}
        effectiveMode={effectiveMode}
        opacity={opacity}
      />
    )
  }

  if (item.type === 'image' || item.type === 'video') {
    return (
      <g opacity={opacity}>
        <PreviewMediaImage
          mediaId={item.mediaId}
          x={item.x}
          y={item.y}
          width={item.width}
          height={item.height}
          opacity={item.type === 'video' ? 0.92 : 1}
        />
      </g>
    )
  }

  if (item.type === 'text') {
    return <PreviewTextItem item={item} opacity={opacity} />
  }

  if (item.type === 'study_hub') {
    return (
      <PreviewStudyHubItem
        item={item}
        effectiveMode={effectiveMode}
        opacity={opacity}
      />
    )
  }

  return null
}

export default function SpaceCardPreview({
  spaceId,
  showDropGhost = false,
}: {
  spaceId: string
  showDropGhost?: boolean
}) {
  const space = useCanvasWorkspaceStore((s) => s.spaces[spaceId])
  const stripScrollY = space?.strip?.scrollY ?? 0
  const dropHover = useSpaceDropStore((s) => s.hover)
  const dropGhost =
    showDropGhost && dropHover?.spaceId === spaceId ? dropHover.ghostItem : null
  const palette = useThemeStore((s) => s.palette)
  const themeMode = useThemeStore((s) => s.mode)
  const effectiveMode = useEffectiveMode(themeMode)

  const sortedItems = useMemo(
    () => [...(space?.items ?? [])].sort((a, b) => a.zIndex - b.zIndex),
    [space?.items],
  )

  if (!space) return null

  const logicalWidth = previewLogicalWidth(space.strip?.logicalWidth)
  const view = previewViewFromStripScroll(stripScrollY, logicalWidth)
  const bg = canvasBackgroundColor(palette, effectiveMode)

  return (
    <div
      style={{
        position: 'relative',
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
        viewBox={previewStripViewBox(logicalWidth)}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
        style={{ display: 'block' }}
      >
        <g transform={previewTransform(view, logicalWidth)}>
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
            <PreviewItem
              key={item.id}
              item={item}
              effectiveMode={effectiveMode}
            />
          ))}
          {dropGhost && (
            <PreviewItem item={dropGhost} effectiveMode={effectiveMode} ghost />
          )}
        </g>
      </svg>
      <div className="space-preview-vignette" aria-hidden />
    </div>
  )
}

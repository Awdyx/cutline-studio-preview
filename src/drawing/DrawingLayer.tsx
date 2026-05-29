import { memo } from 'react'
import { useLassoStore } from './useLassoStore'
import { effectiveCanvasLocked } from '../canvasLock/layer'
import { useCanvasLockStore } from '../canvasLock/canvasLockStore'
import { useCanvasLockFlattenStore } from '../canvasLock/canvasLockFlattenStore'
import { shouldFlattenCanvas } from '../canvasLock/flattenVisibility'
import { useStrokesStore } from './strokesStore'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import { resolveStrokeFill } from './colorUtils'
import { strokeToSvgPath } from './strokePath'
import { useThemeStore } from '../theme/themeStore'
import { useEffectiveMode } from '../theme/useEffectiveMode'
import type { Stroke } from './types'
import {
  Z_ANNOTATION_STROKES,
  Z_ACTIVE_STROKE,
  committedStrokeZIndex,
  isStrokeAboveItems,
  lassoLiftedStrokeZIndex,
} from '../canvasItems/canvasZOrder'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { strokeExtendsOutsideStudioCentre } from '../canvas/studioCentre'
import {
  CANVAS_ORIGINAL_HEIGHT,
  CANVAS_ORIGINAL_WIDTH,
  STUDIO_STROKE_BLEED_PAD,
} from './canvasDimensions'

const HIGHLIGHTER_GLOW_FILTER_ID = 'cutline-highlighter-glow'
const ANNOTATION_GLOW_FILTER_ID = 'cutline-annotation-highlighter-glow'
const ACTIVE_STROKE_GLOW_FILTER_ID = 'cutline-active-stroke-highlighter-glow'

const STROKE_LAYER_WRAP_STYLE = {
  position: 'absolute' as const,
  inset: 0,
  pointerEvents: 'none' as const,
}

const CompletedStrokePath = memo(function CompletedStrokePath({
  stroke,
  fill,
}: {
  stroke: Stroke
  fill: string
}) {
  const d = strokeToSvgPath(stroke, false) || stroke.path
  if (!d) return null
  return <path d={d} fill={fill} />
})

const ActiveStrokePath = memo(function ActiveStrokePath({
  stroke,
  fill,
}: {
  stroke: Stroke
  fill: string
}) {
  const d = strokeToSvgPath(stroke, false)
  if (!d) return null
  return <path d={d} fill={fill} />
})

function strokeLayerNeedsBleed(strokes: Stroke[], activeStroke: Stroke | null): boolean {
  if (activeStroke != null && strokeExtendsOutsideStudioCentre(activeStroke)) return true
  return strokes.some(strokeExtendsOutsideStudioCentre)
}

function StrokeSvgLayer({
  strokes,
  activeStroke,
  zIndex,
  glowFilterId,
  strokeLayer,
  bleed,
}: {
  strokes: Stroke[]
  activeStroke: Stroke | null
  zIndex: number
  glowFilterId: string
  strokeLayer: 'committed' | 'annotation'
  bleed: boolean
}) {
  const themeMode = useThemeStore((s) => s.mode)
  const effectiveMode = useEffectiveMode(themeMode)
  const isDark = effectiveMode === 'dark'
  const dragOffset = useLassoStore((s) => s.dragOffset)

  if (strokes.length === 0 && !activeStroke) return null

  const dragIds = dragOffset ? new Set(dragOffset.ids) : null
  const dx = dragOffset?.canvasDx ?? 0
  const dy = dragOffset?.canvasDy ?? 0
  const hasDraggedStrokes =
    dragIds != null && strokes.some((stroke) => dragIds.has(stroke.id))
  const svgOverflowVisible = bleed || hasDraggedStrokes
  const bleedPad = svgOverflowVisible ? STUDIO_STROKE_BLEED_PAD : 0
  const svgWidth = CANVAS_ORIGINAL_WIDTH + bleedPad * 2
  const svgHeight = CANVAS_ORIGINAL_HEIGHT + bleedPad * 2

  const highlighters = strokes.filter((s) => s.tool === 'highlighter')
  const pens = strokes.filter((s) => s.tool === 'pen')

  const highlighterBlend: React.CSSProperties['mixBlendMode'] = isDark
    ? 'plus-lighter'
    : 'multiply'

  function renderStrokes(list: Stroke[]) {
    if (!dragIds) {
      return list.map((stroke) => (
        <CompletedStrokePath
          key={stroke.id}
          stroke={stroke}
          fill={resolveStrokeFill(stroke.color, stroke.tool, effectiveMode)}
        />
      ))
    }
    const staticStrokes = list.filter((s) => !dragIds.has(s.id))
    const draggedStrokes = list.filter((s) => dragIds.has(s.id))
    return (
      <>
        {staticStrokes.map((stroke) => (
          <CompletedStrokePath
            key={stroke.id}
            stroke={stroke}
            fill={resolveStrokeFill(stroke.color, stroke.tool, effectiveMode)}
          />
        ))}
        {draggedStrokes.length > 0 && (
          <g transform={`translate(${dx},${dy})`}>
            {draggedStrokes.map((stroke) => (
              <CompletedStrokePath
                key={stroke.id}
                stroke={stroke}
                fill={resolveStrokeFill(stroke.color, stroke.tool, effectiveMode)}
              />
            ))}
          </g>
        )}
      </>
    )
  }

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      viewBox={`${-bleedPad} ${-bleedPad} ${svgWidth} ${svgHeight}`}
      aria-hidden
      data-lock-stroke-layer={strokeLayer}
      data-lock-layer={strokeLayer === 'annotation' ? 'annotation' : undefined}
      style={{
        position: 'absolute',
        top: -bleedPad,
        left: -bleedPad,
        zIndex,
        pointerEvents: 'none',
        willChange: svgOverflowVisible ? 'transform' : undefined,
        overflow: svgOverflowVisible ? 'visible' : 'hidden',
      }}
    >
      {isDark && highlighters.length + (activeStroke?.tool === 'highlighter' ? 1 : 0) > 0 && (
        <defs>
          <filter
            id={glowFilterId}
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feComponentTransfer in="blur" result="softBlur">
              <feFuncA type="linear" slope="0.28" intercept="0" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode in="softBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}

      <g
        style={{
          mixBlendMode: highlighterBlend,
          filter: isDark ? `url(#${glowFilterId})` : undefined,
        }}
      >
        {renderStrokes(highlighters)}
        {activeStroke?.tool === 'highlighter' && (
          <ActiveStrokePath
            stroke={activeStroke}
            fill={resolveStrokeFill(
              activeStroke.color,
              activeStroke.tool,
              effectiveMode,
            )}
          />
        )}
      </g>
      {renderStrokes(pens)}
      {activeStroke?.tool === 'pen' && (
        <ActiveStrokePath
          stroke={activeStroke}
          fill={resolveStrokeFill(activeStroke.color, activeStroke.tool, effectiveMode)}
        />
      )}
    </svg>
  )
}

function groupCommittedStrokesByZ(strokes: Stroke[]): [number, Stroke[]][] {
  const groups = new Map<number, Stroke[]>()
  for (const stroke of strokes) {
    const z = committedStrokeZIndex(stroke)
    const bucket = groups.get(z)
    if (bucket) bucket.push(stroke)
    else groups.set(z, [stroke])
  }
  return [...groups.entries()].sort(([a], [b]) => a - b)
}

export type DrawingLayerBand =
  | 'committed-below'
  | 'committed-above'
  | 'annotation'
  | 'active'
  | 'lasso-lifted'

function strokeMatchesBand(stroke: Stroke, band: 'committed-below' | 'committed-above'): boolean {
  const z = committedStrokeZIndex(stroke)
  return band === 'committed-above' ? isStrokeAboveItems(z) : !isStrokeAboveItems(z)
}


export default function DrawingLayer({ band }: { band: DrawingLayerBand }) {
  const activeCanvasId = useCanvasWorkspaceStore((s) => s.activeCanvasId)
  const strokes = useStrokesStore((s) => s.strokes)
  const annotationStrokes = useStrokesStore((s) => s.annotationStrokes)
  const activeStroke = useStrokesStore((s) => s.activeStroke)
  const isLocked = useCanvasLockStore((s) => s.isLocked)
  const flattenReady = useCanvasLockFlattenStore((s) => s.ready)
  const lockActive = effectiveCanvasLocked(isLocked)
  const hideCommittedStrokes =
    shouldFlattenCanvas(isLocked) && flattenReady && strokes.length > 0

  const lassoStrokeIds = useLassoStore((s) => s.selectedStrokeIds)
  const lassoItemIds = useLassoStore((s) => s.selectedItemIds)
  const allItems = useCanvasItemsStore((s) => s.items)
  const isMixedLasso = lassoStrokeIds.length > 0 && lassoItemIds.length > 0
  const liftedIdSet = isMixedLasso ? new Set(lassoStrokeIds) : null
  const lassoDragActive = useLassoStore((s) => s.dragOffset != null)
  const strokeLayerWrapStyle = lassoDragActive
    ? { ...STROKE_LAYER_WRAP_STYLE, overflow: 'visible' as const }
    : STROKE_LAYER_WRAP_STYLE

  if (band === 'annotation') {
    if (annotationStrokes.length === 0) return null
    const bleed = strokeLayerNeedsBleed(annotationStrokes, null)
    return (
      <div key={activeCanvasId} style={strokeLayerWrapStyle}>
        <StrokeSvgLayer
          strokes={annotationStrokes}
          activeStroke={null}
          zIndex={Z_ANNOTATION_STROKES}
          glowFilterId={ANNOTATION_GLOW_FILTER_ID}
          strokeLayer="annotation"
          bleed={bleed}
        />
      </div>
    )
  }

  if (band === 'active') {
    if (!activeStroke) return null
    return (
      <div key={activeCanvasId} style={strokeLayerWrapStyle}>
        <StrokeSvgLayer
          strokes={[]}
          activeStroke={activeStroke}
          zIndex={Z_ACTIVE_STROKE}
          glowFilterId={ACTIVE_STROKE_GLOW_FILTER_ID}
          strokeLayer={lockActive ? 'annotation' : 'committed'}
          bleed
        />
      </div>
    )
  }

  if (band === 'lasso-lifted') {
    if (!isMixedLasso || !liftedIdSet || liftedIdSet.size === 0) return null
    const lifted = strokes.filter((s) => liftedIdSet.has(s.id))
    if (lifted.length === 0) return null
    const bleed = strokeLayerNeedsBleed(lifted, null)
    return (
      <div key={activeCanvasId} style={strokeLayerWrapStyle}>
        {groupCommittedStrokesByZ(lifted).map(([origZ, groupStrokes]) => (
          <StrokeSvgLayer
            key={origZ}
            strokes={groupStrokes}
            activeStroke={null}
            zIndex={lassoLiftedStrokeZIndex(allItems, origZ)}
            glowFilterId={`${HIGHLIGHTER_GLOW_FILTER_ID}-lasso-lifted-${origZ}`}
            strokeLayer="committed"
            bleed={bleed || lassoDragActive}
          />
        ))}
      </div>
    )
  }

  const committedBand = band
  const filtered = strokes.filter(
    (stroke) => strokeMatchesBand(stroke, committedBand) && (!liftedIdSet || !liftedIdSet.has(stroke.id)),
  )
  if (hideCommittedStrokes || filtered.length === 0) return null

  const bleed = strokeLayerNeedsBleed(filtered, null)
  return (
    <div key={activeCanvasId} style={strokeLayerWrapStyle}>
      {groupCommittedStrokesByZ(filtered).map(([zIndex, groupStrokes]) => (
        <StrokeSvgLayer
          key={zIndex}
          strokes={groupStrokes}
          activeStroke={null}
          zIndex={zIndex}
          glowFilterId={`${HIGHLIGHTER_GLOW_FILTER_ID}-${committedBand}-${zIndex}`}
          strokeLayer="committed"
          bleed={bleed || lassoDragActive}
        />
      ))}
    </div>
  )
}

import { memo } from 'react'
import { effectiveCanvasLocked } from '../canvasLock/layer'
import { useCanvasLockStore } from '../canvasLock/canvasLockStore'
import { useCanvasLockFlattenStore } from '../canvasLock/canvasLockFlattenStore'
import { shouldFlattenCanvas } from '../canvasLock/flattenVisibility'
import { useStrokesStore } from './strokesStore'
import { resolveStrokeFill } from './colorUtils'
import { strokeToSvgPath } from './strokePath'
import { useThemeStore } from '../theme/themeStore'
import { useEffectiveMode } from '../theme/useEffectiveMode'
import type { Stroke } from './types'
import { Z_ANNOTATION_STROKES, Z_ACTIVE_STROKE, Z_STROKES } from '../canvasItems/canvasZOrder'
import { CANVAS_HEIGHT, CANVAS_WIDTH } from './canvasDimensions'

const HIGHLIGHTER_GLOW_FILTER_ID = 'cutline-highlighter-glow'
const ANNOTATION_GLOW_FILTER_ID = 'cutline-annotation-highlighter-glow'
const ACTIVE_STROKE_GLOW_FILTER_ID = 'cutline-active-stroke-highlighter-glow'

const CompletedStrokePath = memo(function CompletedStrokePath({
  stroke,
  fill,
}: {
  stroke: Stroke
  fill: string
}) {
  const d = stroke.path
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

function StrokeSvgLayer({
  strokes,
  activeStroke,
  zIndex,
  glowFilterId,
  strokeLayer,
}: {
  strokes: Stroke[]
  activeStroke: Stroke | null
  zIndex: number
  glowFilterId: string
  strokeLayer: 'committed' | 'annotation'
}) {
  const themeMode = useThemeStore((s) => s.mode)
  const effectiveMode = useEffectiveMode(themeMode)
  const isDark = effectiveMode === 'dark'

  if (strokes.length === 0 && !activeStroke) return null

  const highlighters = strokes.filter((s) => s.tool === 'highlighter')
  const pens = strokes.filter((s) => s.tool === 'pen')

  const highlighterBlend: React.CSSProperties['mixBlendMode'] = isDark
    ? 'plus-lighter'
    : 'multiply'

  return (
    <svg
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
      aria-hidden
      data-lock-stroke-layer={strokeLayer}
      data-lock-layer={strokeLayer === 'annotation' ? 'annotation' : undefined}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex,
        pointerEvents: 'none',
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
        {highlighters.map((stroke) => (
          <CompletedStrokePath
            key={stroke.id}
            stroke={stroke}
            fill={resolveStrokeFill(stroke.color, stroke.tool, effectiveMode)}
          />
        ))}
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
      {pens.map((stroke) => (
        <CompletedStrokePath
          key={stroke.id}
          stroke={stroke}
          fill={resolveStrokeFill(stroke.color, stroke.tool, effectiveMode)}
        />
      ))}
      {activeStroke?.tool === 'pen' && (
        <ActiveStrokePath
          stroke={activeStroke}
          fill={resolveStrokeFill(activeStroke.color, activeStroke.tool, effectiveMode)}
        />
      )}
    </svg>
  )
}

export default function DrawingLayer() {
  const strokes = useStrokesStore((s) => s.strokes)
  const annotationStrokes = useStrokesStore((s) => s.annotationStrokes)
  const activeStroke = useStrokesStore((s) => s.activeStroke)
  const isLocked = useCanvasLockStore((s) => s.isLocked)
  const flattenReady = useCanvasLockFlattenStore((s) => s.ready)
  const lockActive = effectiveCanvasLocked(isLocked)
  const hideCommittedStrokes =
    shouldFlattenCanvas(isLocked) && flattenReady && strokes.length > 0

  return (
    <>
      {!hideCommittedStrokes && (
        <StrokeSvgLayer
          strokes={strokes}
          activeStroke={null}
          zIndex={Z_STROKES}
          glowFilterId={HIGHLIGHTER_GLOW_FILTER_ID}
          strokeLayer="committed"
        />
      )}
      <StrokeSvgLayer
        strokes={annotationStrokes}
        activeStroke={null}
        zIndex={Z_ANNOTATION_STROKES}
        glowFilterId={ANNOTATION_GLOW_FILTER_ID}
        strokeLayer="annotation"
      />
      {activeStroke && (
        <StrokeSvgLayer
          strokes={[]}
          activeStroke={activeStroke}
          zIndex={Z_ACTIVE_STROKE}
          glowFilterId={ACTIVE_STROKE_GLOW_FILTER_ID}
          strokeLayer={lockActive ? 'annotation' : 'committed'}
        />
      )}
    </>
  )
}

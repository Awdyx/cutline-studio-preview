import { forwardRef, useId, type SVGProps } from 'react'
import {
  inferTrayStrokeTool,
  resolveTrayStrokeFill,
} from '../drawing/colorUtils'
import { useThemeStore } from '../theme/themeStore'
import { useEffectiveMode } from '../theme/useEffectiveMode'

export type DrawingStroke = {
  id?: string
  path: string
  color: string
  tool?: 'pen' | 'highlighter'
  opacity?: number
}

type DrawingStrokesSvgProps = SVGProps<SVGSVGElement> & {
  strokes: DrawingStroke[]
  activeStroke?: DrawingStroke | null
  /** When set, adds data-stroke-id + pointer events on committed paths (draw tab erase). */
  interactive?: boolean
}

export const DrawingStrokesSvg = forwardRef<SVGSVGElement, DrawingStrokesSvgProps>(
  function DrawingStrokesSvg(
    { strokes, activeStroke, interactive = false, children, ...svgProps },
    ref,
  ) {
    const themeMode = useThemeStore((s) => s.mode)
    const effectiveMode = useEffectiveMode(themeMode)
    const isDark = effectiveMode === 'dark'
    const glowFilterId = useId().replace(/:/g, '')

    const highlighterBlend = (isDark ? 'plus-lighter' : 'multiply') as
      | 'plus-lighter'
      | 'multiply'

    const highlighters = strokes.filter((s) => inferTrayStrokeTool(s) === 'highlighter')
    const pens = strokes.filter((s) => inferTrayStrokeTool(s) === 'pen')
    const activeTool = activeStroke ? inferTrayStrokeTool(activeStroke) : null

    const renderPath = (stroke: DrawingStroke, key: string | number) => {
      const tool = inferTrayStrokeTool(stroke)
      const fill = resolveTrayStrokeFill(stroke.color, tool, effectiveMode)
      return (
        <path
          key={key}
          d={stroke.path}
          fill={fill}
          {...(stroke.id && interactive
            ? { 'data-stroke-id': stroke.id, style: { pointerEvents: 'all' as const } }
            : {})}
        />
      )
    }

    const hasHighlighterGlow =
      isDark && (highlighters.length > 0 || activeTool === 'highlighter')

    return (
      <svg ref={ref} {...svgProps}>
        {hasHighlighterGlow && (
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
            filter: isDark && hasHighlighterGlow ? `url(#${glowFilterId})` : undefined,
          }}
        >
          {highlighters.map((stroke, i) => renderPath(stroke, stroke.id ?? `hl-${i}`))}
          {activeStroke && activeTool === 'highlighter' && renderPath(activeStroke, 'active-hl')}
        </g>

        {pens.map((stroke, i) => renderPath(stroke, stroke.id ?? `pen-${i}`))}
        {activeStroke && activeTool === 'pen' && renderPath(activeStroke, 'active-pen')}

        {children}
      </svg>
    )
  },
)

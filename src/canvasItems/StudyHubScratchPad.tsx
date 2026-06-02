import { useEffect, useRef, useState } from 'react'
import { strokeToSvgPath } from '../drawing/strokePath'
import type { Stroke } from '../drawing/types'
import { studyHubBorderRadiusCss } from './studyHubSpawnScale'
import {
  scratchPadStrokeFill,
  useStudyHubScratchPadDrawing,
} from './useStudyHubScratchPadDrawing'

function ScratchStrokePath({
  stroke,
  isDark,
  complete,
}: {
  stroke: Stroke
  isDark: boolean
  complete: boolean
}) {
  const d = complete
    ? stroke.path ?? strokeToSvgPath(stroke, true)
    : strokeToSvgPath(stroke, false)
  if (!d) return null

  const highlighterBlend: React.CSSProperties['mixBlendMode'] = isDark
    ? 'plus-lighter'
    : 'multiply'

  return (
    <path
      d={d}
      fill={scratchPadStrokeFill(stroke, isDark)}
      style={stroke.tool === 'highlighter' ? { mixBlendMode: highlighterBlend } : undefined}
    />
  )
}

export default function StudyHubScratchPad({
  active,
  height,
  hubWidth,
}: {
  active: boolean
  height: number
  hubWidth: number
}) {
  const padRef = useRef<HTMLDivElement>(null)
  const [padSize, setPadSize] = useState({ width: 0, height: 0 })
  const { strokes, activeStroke, isDark, lassoDrawingPoints } =
    useStudyHubScratchPadDrawing(padRef, active && padSize.width > 0)
  const borderRadius = studyHubBorderRadiusCss(hubWidth)

  const lassoPath =
    lassoDrawingPoints.length > 1
      ? lassoDrawingPoints
          .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
          .join(' ') + ' Z'
      : null

  useEffect(() => {
    const pad = padRef.current
    if (!pad) return

    const sync = () => {
      setPadSize({
        width: pad.clientWidth,
        height: pad.clientHeight,
      })
    }

    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(pad)
    return () => observer.disconnect()
  }, [])

  const viewWidth = Math.max(1, padSize.width)
  const viewHeight = Math.max(1, padSize.height || height)

  return (
    <div
      ref={padRef}
      className="study-hub-scratch-pad"
      data-study-hub-scratch-pad=""
      style={{
        width: '100%',
        height,
        borderRadius,
      }}
    >
      <svg
        aria-hidden
        width="100%"
        height="100%"
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        style={{ display: 'block', touchAction: 'none' }}
      >
        {strokes
          .filter((stroke) => stroke.tool === 'pen')
          .map((stroke) => (
            <ScratchStrokePath
              key={stroke.id}
              stroke={stroke}
              isDark={isDark}
              complete
            />
          ))}
        {strokes
          .filter((stroke) => stroke.tool === 'highlighter')
          .map((stroke) => (
            <ScratchStrokePath
              key={stroke.id}
              stroke={stroke}
              isDark={isDark}
              complete
            />
          ))}
        {activeStroke && (
          <ScratchStrokePath stroke={activeStroke} isDark={isDark} complete={false} />
        )}
      </svg>
      {lassoPath && (
        <svg
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 25,
          }}
        >
          <path
            d={lassoPath}
            fill="var(--lasso-draw-fill)"
            stroke="var(--lasso-draw-stroke)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { strokeToSvgPath } from '../drawing/strokePath'
import type { Stroke } from '../drawing/types'
import { useStudyHubScratchPadWheelScroll } from './useStudyHubScratchPadWheelScroll'
import { studyHubBorderRadiusCss } from './studyHubSpawnScale'
import { studyHubScratchPadContentHeight } from './studyHubScratchPadScroll'
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const padRef = useRef<HTMLDivElement>(null)
  const viewportHeight = Math.max(1, height)
  const contentHeight = studyHubScratchPadContentHeight(viewportHeight)
  const [padWidth, setPadWidth] = useState(0)
  const { strokes, activeStroke, isDark, lassoDrawingPoints } =
    useStudyHubScratchPadDrawing(
      padRef,
      scrollRef,
      active && padWidth > 0,
    )
  const borderRadius = studyHubBorderRadiusCss(hubWidth)

  useStudyHubScratchPadWheelScroll(scrollRef, active)

  const lassoPath =
    lassoDrawingPoints.length > 1
      ? lassoDrawingPoints
          .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
          .join(' ') + ' Z'
      : null

  useEffect(() => {
    if (active) return
    scrollRef.current?.scrollTo({ top: 0, left: 0 })
  }, [active])

  useEffect(() => {
    const pad = padRef.current
    if (!pad) return

    const sync = () => {
      setPadWidth(pad.clientWidth)
    }

    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(pad)
    return () => observer.disconnect()
  }, [])

  const viewWidth = Math.max(1, padWidth)
  const viewHeight = Math.max(1, contentHeight)

  return (
    <div
      className="study-hub-scratch-pad-viewport"
      data-study-hub-scratch-pad-viewport=""
      style={{
        width: '100%',
        height: viewportHeight,
        borderRadius,
      }}
    >
      <div
        ref={scrollRef}
        className="study-hub-scratch-pad"
        data-study-hub-scratch-pad=""
        style={{ width: '100%', height: '100%', borderRadius }}
      >
        <div
          ref={padRef}
          className="study-hub-scratch-pad__surface"
          style={{ width: '100%', minHeight: viewportHeight, height: contentHeight }}
        >
        <svg
          aria-hidden
          width={viewWidth}
          height={viewHeight}
          style={{ display: 'block', pointerEvents: 'none' }}
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
        </div>
      </div>
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

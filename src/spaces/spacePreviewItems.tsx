import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { STUDY_SUBJECT_CATALOG } from '../components/study/studyHubData'
import { resolveStrokeFill } from '../drawing/colorUtils'
import type { Stroke } from '../drawing/types'
import {
  textAlignmentContainerStyle,
  textAlignmentEditorStyle,
  resolveItemTextAlignment,
} from '../canvasItems/textAlignment'
import {
  isStoredTextEmpty,
  storedContentToHtml,
} from '../canvasItems/textEditorContent'
import type {
  StickyCanvasItem,
  StudyHubCanvasItem,
  TextCanvasItem,
} from '../canvasItems/types'
import { TEXT_BOX_PADDING } from '../canvasItems/types'
import { studyHubBorderRadiusForWidth } from '../canvasItems/studyHubSpawnScale'
import { font } from '../styles/tokens'
import { resolveStickyColor, resolveStickyTextColor } from '../theme/paletteGenerator'

const PREVIEW_ROOT: CSSProperties = {
  pointerEvents: 'none',
  userSelect: 'none',
  WebkitUserSelect: 'none',
}

const XHTML_ROOT_PROPS = {
  xmlns: 'http://www.w3.org/1999/xhtml',
} as HTMLAttributes<HTMLDivElement>

function PreviewLocalStrokePaths({
  strokes,
  x,
  y,
  effectiveMode,
  opacity = 1,
}: {
  strokes: Stroke[]
  x: number
  y: number
  effectiveMode: 'light' | 'dark'
  opacity?: number
}) {
  if (strokes.length === 0) return null

  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      {strokes.map((stroke) => {
        if (!stroke.path) return null
        return (
          <path
            key={stroke.id}
            d={stroke.path}
            fill={resolveStrokeFill(stroke.color, stroke.tool, effectiveMode)}
          />
        )
      })}
    </g>
  )
}

function PreviewHtmlForeignObject({
  x,
  y,
  width,
  height,
  opacity = 1,
  children,
}: {
  x: number
  y: number
  width: number
  height: number
  opacity?: number
  children: ReactNode
}) {
  return (
    <foreignObject
      x={x}
      y={y}
      width={width}
      height={height}
      opacity={opacity}
    >
      <div
        {...XHTML_ROOT_PROPS}
        style={{
          ...PREVIEW_ROOT,
          width,
          height,
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </foreignObject>
  )
}

export function PreviewStickyItem({
  item,
  effectiveMode,
  opacity = 1,
}: {
  item: StickyCanvasItem
  effectiveMode: 'light' | 'dark'
  opacity?: number
}) {
  const alignment = resolveItemTextAlignment(item)
  const stickyBg = resolveStickyColor(effectiveMode)
  const stickyText = resolveStickyTextColor(effectiveMode)

  return (
    <g>
      <rect
        x={item.x}
        y={item.y}
        width={item.width}
        height={item.height}
        rx={4}
        fill={stickyBg}
        opacity={opacity}
      />
      <PreviewLocalStrokePaths
        strokes={[...item.strokes, ...(item.annotationStrokes ?? [])]}
        x={item.x}
        y={item.y}
        effectiveMode={effectiveMode}
        opacity={opacity}
      />
      <PreviewHtmlForeignObject
        x={item.x}
        y={item.y}
        width={item.width}
        height={item.height}
        opacity={opacity}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            ...textAlignmentContainerStyle(alignment),
          }}
        >
          <div
            style={{
              padding: '28px 14px 14px',
              fontSize: 15,
              lineHeight: 1.35,
              fontFamily: font.family,
              color: stickyText,
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              ...textAlignmentEditorStyle(alignment),
            }}
          >
            {item.text}
          </div>
        </div>
      </PreviewHtmlForeignObject>
    </g>
  )
}

export function PreviewTextItem({
  item,
  opacity = 1,
}: {
  item: TextCanvasItem
  opacity?: number
}) {
  const alignment = resolveItemTextAlignment(item)
  const empty = isStoredTextEmpty(item.text)
  const html = storedContentToHtml(item.text)

  return (
    <PreviewHtmlForeignObject
      x={item.x}
      y={item.y}
      width={item.width}
      height={item.height}
      opacity={opacity}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          ...textAlignmentContainerStyle(alignment),
        }}
      >
        <div
          className={`canvas-text-editor${empty ? ' canvas-text-editor--empty' : ''}`}
          style={{
            padding: TEXT_BOX_PADDING,
            fontSize: 16,
            lineHeight: 1.45,
            fontFamily: font.family,
            color: font.colorPrimary,
            overflow: 'hidden',
            wordBreak: 'normal',
            overflowWrap: 'break-word',
            boxSizing: 'border-box',
            maxWidth: '100%',
            ...textAlignmentEditorStyle(alignment),
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </PreviewHtmlForeignObject>
  )
}

export function PreviewStudyHubItem({
  item,
  effectiveMode,
  opacity = 1,
}: {
  item: StudyHubCanvasItem
  effectiveMode: 'light' | 'dark'
  opacity?: number
}) {
  const catalog = STUDY_SUBJECT_CATALOG[item.subjectId]
  const cardBg =
    effectiveMode === 'light'
      ? 'rgba(255, 255, 255, 0.85)'
      : 'rgba(44, 46, 50, 0.85)'
  const muted =
    effectiveMode === 'light' ? 'rgba(0, 0, 0, 0.55)' : 'rgba(255, 255, 255, 0.55)'
  const primary =
    effectiveMode === 'light' ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.9)'

  return (
    <g>
      <rect
        x={item.x}
        y={item.y}
        width={item.width}
        height={item.height}
        rx={studyHubBorderRadiusForWidth(item.width)}
        fill={cardBg}
        opacity={opacity}
      />
      <PreviewLocalStrokePaths
        strokes={[...item.strokes, ...(item.annotationStrokes ?? [])]}
        x={item.x}
        y={item.y}
        effectiveMode={effectiveMode}
        opacity={opacity}
      />
      <PreviewHtmlForeignObject
        x={item.x}
        y={item.y}
        width={item.width}
        height={item.height}
        opacity={opacity}
      >
        <div
          style={{
            padding: '18px 22px',
            fontFamily: font.family,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 600,
              lineHeight: 1.25,
              letterSpacing: '0.04em',
              color: primary,
            }}
          >
            {catalog.paperCode}
          </p>
        </div>
      </PreviewHtmlForeignObject>
    </g>
  )
}

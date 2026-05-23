import { chromeLabel, font, menuDividerStyle } from '../styles/tokens'

const DIVIDER_OPACITY = 0.58

const lineStyle = {
  ...menuDividerStyle,
  flex: 1,
  margin: 0,
  height: 1,
} as const

const labelStyle = {
  fontSize: 10,
  fontWeight: 400,
  letterSpacing: '0.04em',
  color: font.colorMuted,
  flexShrink: 0,
  fontFamily: font.family,
} as const

export function PanelNewOldDivider({ label }: { label: string }) {
  const text = chromeLabel(label)

  return (
    <div
      role="separator"
      aria-label={text}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        margin: '10px 16px',
        flexShrink: 0,
        opacity: DIVIDER_OPACITY,
      }}
    >
      <div aria-hidden style={lineStyle} />
      <span style={labelStyle}>{text}</span>
      <div aria-hidden style={lineStyle} />
    </div>
  )
}

export function partitionNewOld<T>(
  items: readonly T[],
  isNew: (item: T) => boolean,
): { newItems: T[]; oldItems: T[] } {
  const newItems: T[] = []
  const oldItems: T[] = []
  for (const item of items) {
    if (isNew(item)) newItems.push(item)
    else oldItems.push(item)
  }
  return { newItems, oldItems }
}

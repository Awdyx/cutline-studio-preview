import type { CSSProperties } from 'react'
import lassoToolIcon from './lasso-tool-icon.png'

type Props = {
  size?: number | string
  strokeWidth?: number | string
  color?: string
  stroke?: string
  className?: string
  style?: CSSProperties
}

const maskBase: CSSProperties = {
  display: 'inline-block',
  flexShrink: 0,
  WebkitMaskImage: `url(${lassoToolIcon})`,
  maskImage: `url(${lassoToolIcon})`,
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
  WebkitMaskPosition: 'center',
  maskPosition: 'center',
  WebkitMaskSize: 'contain',
  maskSize: 'contain',
}

/** SVG Repo lasso tool — dashed loop + filled arrow. */
export function LassoIcon({
  size = 24,
  color,
  stroke,
  className,
  style,
}: Props) {
  const ink = color ?? stroke ?? 'currentColor'

  return (
    <span
      aria-hidden
      className={className}
      style={{
        ...maskBase,
        width: size,
        height: size,
        backgroundColor: ink,
        ...style,
      }}
    />
  )
}

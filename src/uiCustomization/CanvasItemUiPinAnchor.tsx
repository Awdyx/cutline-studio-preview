import type { CSSProperties, ReactNode } from 'react'
import UiPinHost from './UiPinHost'
import { canvasItemUiAnchorId } from './types'

export default function CanvasItemUiPinAnchor({
  itemId,
  className,
  style,
  registerAnchor = true,
  focused = false,
  children,
}: {
  itemId: string
  className?: string
  style?: CSSProperties
  registerAnchor?: boolean
  focused?: boolean
  children: ReactNode
}) {
  const anchorId = canvasItemUiAnchorId(itemId)

  return (
    <div
      {...(registerAnchor ? { 'data-ui-anchor': anchorId } : {})}
      data-ui-anchor-focused={focused ? '1' : undefined}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        ...style,
      }}
    >
      {children}
      <UiPinHost anchorId={anchorId} />
    </div>
  )
}

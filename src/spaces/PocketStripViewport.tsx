import type { ReactNode, RefObject } from 'react'
import {
  POCKET_STRIP_CENTER_Y,
  POCKET_STRIP_VIRTUAL_HEIGHT,
} from './pocketStripDimensions'
import { usePocketStripScroll } from './usePocketStripScroll'

type Props = {
  activeSpaceId: string
  viewportWidth: number
  viewportHeight: number
  canvasRef: RefObject<HTMLDivElement | null>
  canvasFadeOpacity: number
  canvasSwapBusy: boolean
  swapTransition: string | undefined
  onCanvasMount: (node: HTMLDivElement | null) => void
  selectionHandlers: {
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void
    onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void
  }
  onContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void
  onDoubleClick: (event: React.MouseEvent<HTMLDivElement>) => void
  children: ReactNode
}

export default function PocketStripViewport({
  activeSpaceId,
  viewportWidth,
  viewportHeight,
  canvasRef,
  canvasFadeOpacity,
  canvasSwapBusy,
  swapTransition,
  onCanvasMount,
  selectionHandlers,
  onContextMenu,
  onDoubleClick,
  children,
}: Props) {
  const { scrollRef, onScroll, visualScale, logicalWidth, scrollContentHeight } =
    usePocketStripScroll(viewportWidth, viewportHeight, activeSpaceId)

  return (
    <div
      className="cutline-canvas-bg cutline-canvas-pocket pocket-strip-shell"
      style={{
        width: viewportWidth,
        height: viewportHeight,
        opacity: canvasFadeOpacity,
        transition: canvasSwapBusy ? swapTransition : undefined,
        pointerEvents: canvasSwapBusy ? 'none' : undefined,
      }}
    >
      <div
        ref={scrollRef}
        className="pocket-strip-viewport"
        onScroll={onScroll}
      >
        <div
          className="pocket-strip-scroll-spacer"
          style={{ height: scrollContentHeight }}
        >
          <div
            className="pocket-strip-scaled-host"
            style={{
              width: viewportWidth,
              height: scrollContentHeight,
            }}
          >
            <div
              ref={(node) => {
                ;(canvasRef as { current: HTMLDivElement | null }).current = node
                onCanvasMount(node)
              }}
              className="cutline-draw-target cutline-draw-target--pocket draw-target pocket-strip-logical"
              style={{
                width: logicalWidth,
                height: POCKET_STRIP_VIRTUAL_HEIGHT,
                transform: `scale(${visualScale})`,
                transformOrigin: 'top left',
                ['--pocket-strip-logical-width' as string]: `${logicalWidth}px`,
                ['--pocket-strip-center-y' as string]: `${POCKET_STRIP_CENTER_Y}`,
                ['--pocket-strip-scale' as string]: `${visualScale}`,
              }}
              {...selectionHandlers}
              onContextMenu={onContextMenu}
              onDoubleClick={onDoubleClick}
            >
              <div className="pocket-strip-origin-root">
                <div className="pocket-strip-surface">
                  <div className="pocket-strip-content-inner">{children}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

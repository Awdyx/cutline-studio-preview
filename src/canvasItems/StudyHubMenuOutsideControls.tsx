import { Pen, X } from 'lucide-react'
import { studyHubBorderRadiusForWidth } from './studyHubSpawnScale'

export function studyHubOutsideButtonMetrics(hubWidth: number) {
  const cornerRadius = studyHubBorderRadiusForWidth(hubWidth)
  const size = cornerRadius * 2
  const gap = Math.max(8, cornerRadius * 0.4)
  const stackGap = Math.max(6, cornerRadius * 0.35)
  const iconSize = Math.max(12, Math.round(cornerRadius * 0.72))
  return {
    cornerRadius,
    size,
    gap,
    stackGap,
    iconSize,
  }
}

/** Horizontal extent of the outside control stack to the right of the hub edge. */
export function studyHubOutsideControlsOverflowPx(hubWidth: number): number {
  const { size, gap } = studyHubOutsideButtonMetrics(hubWidth)
  return size + gap
}

const STUDY_HUB_OUTSIDE_CONTROLS_VIEWPORT_MARGIN_PX = 8

function viewportRightLimitPx(): number {
  if (typeof window === 'undefined') return Infinity
  const vv = window.visualViewport
  if (vv) {
    return (
      vv.offsetLeft +
      vv.width -
      STUDY_HUB_OUTSIDE_CONTROLS_VIEWPORT_MARGIN_PX
    )
  }
  return window.innerWidth - STUDY_HUB_OUTSIDE_CONTROLS_VIEWPORT_MARGIN_PX
}

/** Keep the outside X / pen stack on-screen when the hub hugs the viewport edge. */
export function resolveStudyHubOutsideControlsPlacement({
  containerLeft,
  containerWidth,
  hubWidth,
  scratchPadOpen,
  viewportTick: _viewportTick = 0,
}: {
  containerLeft: number
  containerWidth: number
  hubWidth: number
  scratchPadOpen: boolean
  /** Bumped on resize so placement re-clamps to the viewport. */
  viewportTick?: number
}): { right: number; top: number } {
  void _viewportTick
  const metrics = studyHubOutsideButtonMetrics(hubWidth)
  if (scratchPadOpen) {
    return { right: metrics.gap, top: metrics.gap }
  }

  const desiredRight = -(metrics.size + metrics.gap)
  const containerRight = containerLeft + containerWidth
  const controlsRightEdge =
    containerRight + studyHubOutsideControlsOverflowPx(hubWidth)
  const viewportRight = viewportRightLimitPx()

  if (controlsRightEdge <= viewportRight) {
    return { right: desiredRight, top: 0 }
  }

  return {
    right: desiredRight + (controlsRightEdge - viewportRight),
    top: 0,
  }
}

function StudyHubOutsideButton({
  metrics,
  top,
  ariaLabel,
  active = false,
  onClick,
  children,
}: {
  metrics: ReturnType<typeof studyHubOutsideButtonMetrics>
  top: number
  ariaLabel: string
  active?: boolean
  onClick?: (e: React.MouseEvent | React.PointerEvent) => void
  children: React.ReactNode
}) {
  const { cornerRadius, size } = metrics

  return (
    <button
      type="button"
      className={`study-hub-menu-dismiss study-hub-menu-dismiss--outside${active ? ' study-hub-menu-dismiss--active' : ''}`}
      aria-label={ariaLabel}
      aria-pressed={active || undefined}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(e)
      }}
      style={{
        position: 'absolute',
        top,
        right: 0,
        width: size,
        height: size,
        borderRadius: cornerRadius,
      }}
    >
      {children}
    </button>
  )
}

export default function StudyHubMenuOutsideControls({
  hubWidth,
  scratchPadOpen,
  onDismiss,
  onPenClick,
}: {
  hubWidth: number
  scratchPadOpen: boolean
  onDismiss: (e: React.MouseEvent | React.PointerEvent) => void
  onPenClick: (e: React.MouseEvent | React.PointerEvent) => void
}) {
  const metrics = studyHubOutsideButtonMetrics(hubWidth)
  const { iconSize, size, stackGap } = metrics

  return (
    <div
      className="study-hub-menu-focus-frame__controls-stack"
      style={{
        position: 'relative',
        width: size,
        height: size * 2 + stackGap,
      }}
    >
      <StudyHubOutsideButton
        metrics={metrics}
        top={0}
        ariaLabel="Return to previous canvas view"
        onClick={(e) => {
          e.preventDefault()
          onDismiss(e)
        }}
      >
        <X size={iconSize} strokeWidth={2} />
      </StudyHubOutsideButton>
      <StudyHubOutsideButton
        metrics={metrics}
        top={size + stackGap}
        ariaLabel="Open scratch pad"
        active={scratchPadOpen}
        onClick={(e) => {
          e.preventDefault()
          onPenClick(e)
        }}
      >
        <Pen size={iconSize} strokeWidth={2} />
      </StudyHubOutsideButton>
    </div>
  )
}

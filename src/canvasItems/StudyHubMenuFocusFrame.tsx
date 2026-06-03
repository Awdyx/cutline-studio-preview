import { animate, motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { studyHubMenuFocusScreenRect } from '../canvas/canvasCamera'
import { studyHubBorderRadiusForWidth } from './studyHubSpawnScale'
import StudyHubMenuOutsideControls, {
  resolveStudyHubOutsideControlsPlacement,
  studyHubOutsideControlsOverflowPx,
} from './StudyHubMenuOutsideControls'
import StudyHubScratchPad from './StudyHubScratchPad'
import StudyHubMenuFocusSplitHandle from './StudyHubMenuFocusSplitHandle'
import { useCanvasItemsStore } from './canvasItemsStore'
import { toggleStudyHubMenuFocusScratchPad } from './studyHubMenuFocus'
import {
  STUDY_HUB_SCRATCH_PAD_EASE,
  STUDY_HUB_SCRATCH_PAD_GAP,
  STUDY_HUB_SCRATCH_PAD_TRANSITION_MS,
  computeStudyHubMenuFocusLayout,
  resolveMenuFocusScratchSplitShare,
  studyHubMenuFocusSplitBounds,
  studyHubMenuFocusSplitControlsPlacement,
} from './studyHubMenuFocusLayout'
import { useStudyHubMenuFocusViewportTick } from './useStudyHubMenuFocusViewportTick'

const frameTransition = {
  duration: STUDY_HUB_SCRATCH_PAD_TRANSITION_MS / 1000,
  ease: STUDY_HUB_SCRATCH_PAD_EASE,
} as const

const snapTransition = { duration: 0 } as const

const splitOvershootSpring = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
  mass: 0.45,
}

export default function StudyHubMenuFocusFrame({
  hubRect,
  transformRef,
  chromeVisible,
  hubPanelClassName,
  onDismiss,
  children,
}: {
  hubRect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  chromeVisible: boolean
  hubPanelClassName?: string
  onDismiss: (e: React.MouseEvent | React.PointerEvent) => void
  children: ReactNode
}) {
  const reduceMotion = useReducedMotion()
  const scratchPadOpen = useCanvasItemsStore((s) => s.menuFocusScratchPadOpen)
  const scratchSplitShare = useCanvasItemsStore((s) => s.menuFocusScratchSplitShare)
  const dismissScratchClosing = useCanvasItemsStore(
    (s) => s.menuFocusDismissScratchClosing,
  )
  const menuFocusRevealed = useCanvasItemsStore((s) => s.menuFocusRevealed)
  const menuFocusEphemeral = useCanvasItemsStore(
    (s) => s.menuFocusEphemeralSubjectId != null,
  )
  const responsiveLayout =
    menuFocusEphemeral ||
    menuFocusRevealed ||
    scratchPadOpen ||
    dismissScratchClosing
  const viewportTick = useStudyHubMenuFocusViewportTick(
    transformRef,
    chromeVisible || responsiveLayout,
  )
  const [scratchAnimating, setScratchAnimating] = useState(false)
  const [splitDragging, setSplitDragging] = useState(false)
  const [splitOvershootPx, setSplitOvershootPx] = useState(0)
  const [splitOvershootSnapping, setSplitOvershootSnapping] = useState(false)
  const splitOvershootPxRef = useRef(0)
  const splitOvershootAnimRef = useRef<ReturnType<typeof animate> | null>(null)
  const prevScratchOpenRef = useRef(scratchPadOpen)
  const scratchJustToggled = prevScratchOpenRef.current !== scratchPadOpen

  useLayoutEffect(() => {
    if (!scratchJustToggled) return

    prevScratchOpenRef.current = scratchPadOpen
    if (reduceMotion) return

    setScratchAnimating(true)
    const timer = window.setTimeout(() => {
      setScratchAnimating(false)
    }, STUDY_HUB_SCRATCH_PAD_TRANSITION_MS)

    return () => window.clearTimeout(timer)
  }, [scratchPadOpen, reduceMotion, scratchJustToggled])

  const layout = computeStudyHubMenuFocusLayout(
    hubRect,
    scratchPadOpen,
    transformRef.current,
    {
      responsive: responsiveLayout,
      scratchSplitShare: scratchSplitShare,
    },
  )
  const splitBounds = scratchPadOpen
    ? studyHubMenuFocusSplitBounds(layout.container.width)
    : null
  const soloFocusRect = transformRef.current
    ? studyHubMenuFocusScreenRect(transformRef.current)
    : null
  const effectiveSplitShare =
    splitBounds && soloFocusRect
      ? resolveMenuFocusScratchSplitShare(
          layout.container.width,
          soloFocusRect.width,
          scratchSplitShare,
        )
      : (scratchSplitShare ?? 0.5)

  const hubBorderRadius = studyHubBorderRadiusForWidth(layout.hub.width)
  const smoothLayout =
    !splitDragging &&
    !reduceMotion &&
    (scratchPadOpen ||
      dismissScratchClosing ||
      scratchAnimating ||
      scratchJustToggled)
  const layoutTransition = smoothLayout ? frameTransition : snapTransition
  const splitPanelTransition =
    splitDragging || reduceMotion
      ? snapTransition
      : splitOvershootSnapping
        ? splitOvershootSpring
        : layoutTransition

  const splitHubWidth = layout.hub.width - splitOvershootPx
  const splitScratchLeft = splitHubWidth + STUDY_HUB_SCRATCH_PAD_GAP
  const splitScratchWidth = Math.max(0, layout.container.width - splitScratchLeft)

  const snapSplitOvershoot = useCallback(() => {
    const from = splitOvershootPxRef.current
    if (from === 0 || reduceMotion) {
      setSplitOvershootPx(0)
      setSplitOvershootSnapping(false)
      return
    }
    setSplitOvershootSnapping(true)
    splitOvershootAnimRef.current?.stop()
    splitOvershootAnimRef.current = animate(from, 0, {
      ...splitOvershootSpring,
      onUpdate: (v) => {
        splitOvershootPxRef.current = v
        setSplitOvershootPx(v)
      },
      onComplete: () => {
        splitOvershootAnimRef.current = null
        splitOvershootPxRef.current = 0
        setSplitOvershootPx(0)
        setSplitOvershootSnapping(false)
      },
    })
  }, [reduceMotion])

  useEffect(() => {
    splitOvershootPxRef.current = splitOvershootPx
  }, [splitOvershootPx])

  useEffect(() => {
    if (!scratchPadOpen) setSplitOvershootPx(0)
  }, [scratchPadOpen])

  const hubDisplayWidth = scratchPadOpen ? splitHubWidth : layout.hub.width
  const outsideControlsMetricsHubWidth =
    scratchPadOpen && soloFocusRect ? soloFocusRect.width : layout.hub.width

  const scratchClosingControls =
    scratchAnimating && !scratchPadOpen && !reduceMotion
  const closedControlsPlacement = resolveStudyHubOutsideControlsPlacement({
    containerLeft: layout.container.left,
    containerWidth: layout.container.width,
    hubWidth: layout.hub.width,
    metricsHubWidth: outsideControlsMetricsHubWidth,
    scratchPadOpen: false,
    viewportTick,
  })
  const openControlsPlacement = scratchPadOpen
    ? resolveStudyHubOutsideControlsPlacement({
        containerLeft: layout.container.left,
        containerWidth: layout.container.width,
        hubWidth: layout.hub.width,
        metricsHubWidth: outsideControlsMetricsHubWidth,
        scratchPadOpen: true,
        viewportTick,
      })
    : transformRef.current
      ? studyHubMenuFocusSplitControlsPlacement(
          transformRef.current,
          scratchSplitShare,
          outsideControlsMetricsHubWidth,
          viewportTick,
        )
      : null

  const controlsCloseNudge = studyHubOutsideControlsOverflowPx(
    outsideControlsMetricsHubWidth,
  )
  const settledClosedRight =
    closedControlsPlacement.right - controlsCloseNudge * 0.35
  const controlsTransition = scratchClosingControls
    ? {
        duration: STUDY_HUB_SCRATCH_PAD_TRANSITION_MS / 1000,
        ease: STUDY_HUB_SCRATCH_PAD_EASE,
      }
    : layoutTransition

  const controlsAnimate =
    scratchClosingControls && openControlsPlacement
      ? {
          right: [openControlsPlacement.right, settledClosedRight],
          top: [openControlsPlacement.top, closedControlsPlacement.top],
        }
      : {
          right: scratchPadOpen
            ? (openControlsPlacement ?? closedControlsPlacement).right
            : settledClosedRight,
          top: scratchPadOpen
            ? (openControlsPlacement ?? closedControlsPlacement).top
            : closedControlsPlacement.top,
        }

  return (
    <motion.div
      className="study-hub-menu-focus-frame"
      data-study-hub-scratch-open={scratchPadOpen ? '' : undefined}
      data-study-hub-scratch-animating={scratchAnimating ? '' : undefined}
      data-study-hub-scratch-closing={scratchClosingControls ? '' : undefined}
      data-study-hub-split-dragging={splitDragging ? '' : undefined}
      data-study-hub-split-overshoot={
        Math.abs(splitOvershootPx) > 0.5 ? '' : undefined
      }
      data-study-hub-layout-smooth={smoothLayout ? '' : undefined}
      initial={false}
      animate={{
        left: layout.container.left,
        top: layout.container.top,
        width: layout.container.width,
        height: layout.container.height,
      }}
      transition={layoutTransition}
      style={{
        position: 'fixed',
        overflow: 'visible',
        zIndex: 0,
      }}
    >
      {chromeVisible && (
        <motion.div
          className="study-hub-menu-focus-frame__controls"
          data-study-hub-scratch-controls={scratchPadOpen ? '' : undefined}
          initial={false}
          animate={controlsAnimate}
          transition={controlsTransition}
          style={{
            position: 'absolute',
            zIndex: 5,
            pointerEvents: 'auto',
          }}
        >
          <StudyHubMenuOutsideControls
            hubWidth={outsideControlsMetricsHubWidth}
            scratchPadOpen={scratchPadOpen}
            onDismiss={onDismiss}
            onPenClick={() => toggleStudyHubMenuFocusScratchPad()}
          />
        </motion.div>
      )}

      <motion.div
        className={`study-hub-canvas-shell plus-fab-menu-glass study-hub-menu-focus-frame__hub study-hub-menu-focus-frame__hub--fluid${hubPanelClassName ? ` ${hubPanelClassName}` : ''}`}
        initial={false}
        animate={{
          width: hubDisplayWidth,
          height: layout.hub.height,
          borderRadius: hubBorderRadius,
        }}
        transition={scratchPadOpen ? splitPanelTransition : layoutTransition}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          overflow: 'hidden',
        }}
      >
        <div className="study-hub-menu-focus-frame__hub-inner">{children}</div>
      </motion.div>

      {scratchPadOpen && splitBounds && (
        <StudyHubMenuFocusSplitHandle
          left={splitHubWidth}
          height={layout.hub.height}
          scratchTravel={Math.max(
            1,
            splitBounds.scratchMax - splitBounds.scratchMin,
          )}
          splitShare={effectiveSplitShare}
          smoothLayout={smoothLayout}
          onDragStart={() => {
            splitOvershootAnimRef.current?.stop()
            splitOvershootAnimRef.current = null
            setSplitOvershootSnapping(false)
            setSplitDragging(true)
          }}
          onDragEnd={() => {
            setSplitDragging(false)
            snapSplitOvershoot()
          }}
          onOvershootChange={setSplitOvershootPx}
          panelTransition={splitPanelTransition}
        />
      )}

      <motion.div
        className="study-hub-menu-focus-frame__scratch-wrap"
        initial={false}
        animate={{
          left: scratchPadOpen ? splitScratchLeft : layout.scratch.left,
          width: scratchPadOpen ? splitScratchWidth : layout.scratch.width,
        }}
        transition={scratchPadOpen ? splitPanelTransition : layoutTransition}
        style={{
          position: 'absolute',
          top: 0,
          height: layout.hub.height,
          overflow: 'hidden',
          pointerEvents: scratchPadOpen ? 'auto' : 'none',
        }}
      >
        <StudyHubScratchPad
          active={scratchPadOpen}
          height={layout.scratch.height}
          hubWidth={layout.hub.width}
        />
      </motion.div>
    </motion.div>
  )
}

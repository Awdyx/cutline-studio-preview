import { motion, useReducedMotion } from 'framer-motion'
import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { studyHubBorderRadiusForWidth } from './studyHubSpawnScale'
import StudyHubMenuOutsideControls, {
  resolveStudyHubOutsideControlsPlacement,
} from './StudyHubMenuOutsideControls'
import StudyHubScratchPad from './StudyHubScratchPad'
import StudyHubMenuFocusSplitHandle from './StudyHubMenuFocusSplitHandle'
import { useCanvasItemsStore } from './canvasItemsStore'
import { toggleStudyHubMenuFocusScratchPad } from './studyHubMenuFocus'
import {
  STUDY_HUB_SCRATCH_PAD_EASE,
  STUDY_HUB_SCRATCH_PAD_TRANSITION_MS,
  computeStudyHubMenuFocusLayout,
  splitShareFromScratchWidth,
  studyHubMenuFocusSplitBounds,
} from './studyHubMenuFocusLayout'
import { useStudyHubMenuFocusViewportTick } from './useStudyHubMenuFocusViewportTick'

const frameTransition = {
  duration: STUDY_HUB_SCRATCH_PAD_TRANSITION_MS / 1000,
  ease: STUDY_HUB_SCRATCH_PAD_EASE,
} as const

const snapTransition = { duration: 0 } as const

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
  const setScratchSplitShare = useCanvasItemsStore(
    (s) => s.setMenuFocusScratchSplitShare,
  )
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

  const seedSplitShareFromLayout = () => {
    if (scratchSplitShare != null || !splitBounds) return
    setScratchSplitShare(
      splitShareFromScratchWidth(layout.container.width, layout.scratch.width),
    )
  }

  const hubBorderRadius = studyHubBorderRadiusForWidth(layout.hub.width)
  const smoothLayout =
    !splitDragging &&
    !reduceMotion &&
    (scratchPadOpen ||
      dismissScratchClosing ||
      scratchAnimating ||
      scratchJustToggled)
  const layoutTransition = smoothLayout ? frameTransition : snapTransition
  const { right: controlsRight, top: controlsTop } =
    resolveStudyHubOutsideControlsPlacement({
      containerLeft: layout.container.left,
      containerWidth: layout.container.width,
      hubWidth: layout.hub.width,
      scratchPadOpen,
      viewportTick,
    })

  return (
    <motion.div
      className="study-hub-menu-focus-frame"
      data-study-hub-scratch-open={scratchPadOpen ? '' : undefined}
      data-study-hub-scratch-animating={scratchAnimating ? '' : undefined}
      data-study-hub-split-dragging={splitDragging ? '' : undefined}
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
          animate={{ right: controlsRight, top: controlsTop }}
          transition={layoutTransition}
          style={{
            position: 'absolute',
            zIndex: 5,
            pointerEvents: 'auto',
          }}
        >
          <StudyHubMenuOutsideControls
            hubWidth={layout.hub.width}
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
          width: layout.hub.width,
          height: layout.hub.height,
          borderRadius: hubBorderRadius,
        }}
        transition={layoutTransition}
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
          left={layout.hub.width}
          height={layout.hub.height}
          splittableW={splitBounds.splittableW}
          smoothLayout={smoothLayout}
          onDragStart={() => {
            seedSplitShareFromLayout()
            setSplitDragging(true)
          }}
          onDragEnd={() => setSplitDragging(false)}
        />
      )}

      <motion.div
        className="study-hub-menu-focus-frame__scratch-wrap"
        initial={false}
        animate={{
          left: layout.scratch.left,
          width: layout.scratch.width,
        }}
        transition={layoutTransition}
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

import { useLayoutEffect, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  canvasDomHeight,
  canvasDomWidth,
  canvasLayoutHeight,
  canvasLayoutWidth,
} from '../drawing/canvasDimensions'
import type { SpaceCamera } from '../spaces/types'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import {
  applyCameraWhenTransformLayoutReadySync,
  isTransformLayoutReady,
  settleCanvasBounds,
  writeLibraryCameraTransform,
} from './canvasCamera'
import {
  refreshCanvasFrostedSurfaces,
  refreshOverviewExitCompositorItems,
  scheduleCanvasTransformLayerFlush,
} from './canvasCompositorLayer'
import {
  type OverviewLayoutHandoff,
  useCanvasOverviewStore,
} from './canvasOverviewStore'
import { useStudioCentrePositionStore } from './studioCentrePositionStore'
import { libraryCameraFromVirtual } from './canvasVirtualPan'

function completeEnterHandoff(
  ref: ReactZoomPanPinchContentRef,
  virtual: SpaceCamera,
): void {
  const library = libraryCameraFromVirtual(virtual)
  writeLibraryCameraTransform(
    ref,
    library.positionX,
    library.positionY,
    library.scale,
    0,
  )
  ref.instance.update(ref.instance.props)
}

/** Map hyper-plate library camera → normal void camera (applied before DOM expands). */
function completeExitHandoff(
  ref: ReactZoomPanPinchContentRef,
  library: SpaceCamera,
): void {
  const { x: sx, y: sy } = useStudioCentrePositionStore.getState()
  const virtual = {
    positionX: library.positionX - sx * library.scale,
    positionY: library.positionY - sy * library.scale,
    scale: library.scale,
  }
  writeLibraryCameraTransform(
    ref,
    virtual.positionX,
    virtual.positionY,
    virtual.scale,
    0,
  )
  ref.instance.update(ref.instance.props)
}

function settleExpandedExitCamera(ref: ReactZoomPanPinchContentRef): void {
  settleCanvasBounds(ref)
  useCanvasWorkspaceStore.getState().syncMainCamera(ref)
}

function waitForTransformLayoutHandoff(
  ref: ReactZoomPanPinchContentRef,
  expectedWidth: number,
  expectedHeight: number,
  layoutMode: 'enter' | 'exit',
  apply: () => void,
  attempt = 0,
): void {
  if (isTransformLayoutReady(ref, expectedWidth, expectedHeight, layoutMode)) {
    apply()
    return
  }

  if (attempt >= 120) {
    apply()
    return
  }

  requestAnimationFrame(() =>
    waitForTransformLayoutHandoff(
      ref,
      expectedWidth,
      expectedHeight,
      layoutMode,
      apply,
      attempt + 1,
    ),
  )
}

function finishLayoutHandoff(
  ref: ReactZoomPanPinchContentRef,
  handoff: OverviewLayoutHandoff,
): void {
  if (handoff.mode === 'enter') {
    completeEnterHandoff(ref, handoff.virtual)
    useCanvasOverviewStore.getState().setLayoutHandoff(null)
    handoff.onComplete?.()
    return
  }

  // Still on the plate-sized layer — convert camera, then expand + studio offset together.
  completeExitHandoff(ref, handoff.library)
  flushSync(() => {
    useCanvasOverviewStore.getState().setLayoutHandoff(null)
  })

  const expandedWidth = canvasLayoutWidth(false)
  const expandedHeight = canvasLayoutHeight(false)
  const settledSync = applyCameraWhenTransformLayoutReadySync(
    ref,
    expandedWidth,
    expandedHeight,
    () => settleExpandedExitCamera(ref),
    48,
    'exit',
  )
  if (!settledSync) {
    waitForTransformLayoutHandoff(
      ref,
      expandedWidth,
      expandedHeight,
      'exit',
      () => settleExpandedExitCamera(ref),
    )
  }

  useCanvasOverviewStore.getState().beginExitSettling()
  const contentRoot = ref.instance.contentComponent
  refreshOverviewExitCompositorItems(contentRoot)
  refreshCanvasFrostedSurfaces(contentRoot)
  scheduleCanvasTransformLayerFlush(contentRoot, ref)
  handoff.onComplete?.()
  requestAnimationFrame(() => {
    refreshOverviewExitCompositorItems(contentRoot)
    refreshCanvasFrostedSurfaces(contentRoot)
  })
}

/** Apply overview hyper DOM resize + camera conversion before paint. */
export function useOverviewHyperLayoutHandoff(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
) {
  const hyperOptimized = useCanvasOverviewStore((s) => s.hyperOptimized)
  const layoutHandoff = useCanvasOverviewStore((s) => s.layoutHandoff)

  useLayoutEffect(() => {
    const handoff = useCanvasOverviewStore.getState().layoutHandoff
    if (!handoff) return

    const ref = transformRef.current
    if (!ref) return

    // Enter waits for plate shrink; exit waits while still on plate before expanding.
    const expectedWidth = canvasDomWidth()
    const expectedHeight = canvasDomHeight()
    const layoutMode = 'enter' as const

    let cancelled = false

    const finish = () => {
      if (cancelled) return
      if (useCanvasOverviewStore.getState().layoutHandoff !== handoff) return
      finishLayoutHandoff(ref, handoff)
    }

    const appliedSync = applyCameraWhenTransformLayoutReadySync(
      ref,
      expectedWidth,
      expectedHeight,
      finish,
      48,
      layoutMode,
    )

    if (appliedSync) return

    waitForTransformLayoutHandoff(
      ref,
      expectedWidth,
      expectedHeight,
      layoutMode,
      finish,
    )

    return () => {
      cancelled = true
    }
  }, [hyperOptimized, layoutHandoff, transformRef])
}

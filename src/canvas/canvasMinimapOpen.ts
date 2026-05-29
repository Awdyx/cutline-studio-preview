import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { playSound } from '../sound/playSound'
import {
  runCanvasFisheyeEnter,
  runCanvasFisheyeExit,
} from './canvasBarrelPostProcess'
import { useCanvasFisheyeStore } from './canvasFisheyeStore'
import { useCanvasMinimapStore } from './canvasMinimapStore'

/** Expand the map overlay while fisheye is already active (collapsed minimap click). */
export function expandCanvasMinimap(): void {
  const minimap = useCanvasMinimapStore.getState()
  if (minimap.expandedOpen) return
  minimap.setRepositionHintOpen(false)
  minimap.setExpandedOpen(true)
  playSound('minimapOpen')
}

/** Open the expanded map from the studio reposition control (fisheye only). */
export function openCanvasMinimapFromReposition(): void {
  if (!useCanvasFisheyeStore.getState().engaged) return
  const minimap = useCanvasMinimapStore.getState()
  if (minimap.expandedOpen) return
  minimap.setRepositionHintOpen(true)
  minimap.setExpandedOpen(true)
  playSound('minimapOpen')
}

/** Open the expanded canvas map — enters fisheye first when needed. */
export function openCanvasMinimap(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
): void {
  if (!useCanvasFisheyeStore.getState().engaged) {
    runCanvasFisheyeEnter(transformRef.current, null)
  }
  const minimap = useCanvasMinimapStore.getState()
  minimap.setRepositionHintOpen(false)
  minimap.setExpandedOpen(true)
  playSound('minimapOpen')
}

/** Open the map only while fisheye is already active (e.g. right-click void). */
export function openCanvasMinimapFromFisheye(): boolean {
  if (!useCanvasFisheyeStore.getState().engaged) return false
  const minimap = useCanvasMinimapStore.getState()
  minimap.setRepositionHintOpen(false)
  minimap.setExpandedOpen(true)
  playSound('minimapOpen')
  return true
}

/** Drop expanded-map UI when leaving fisheye (no close SFX). */
export function resetCanvasMinimapUiState(): void {
  const minimap = useCanvasMinimapStore.getState()
  if (!minimap.expandedOpen && !minimap.repositionHintOpen) return
  minimap.setRepositionHintOpen(false)
  minimap.setExpandedOpen(false)
  document.documentElement.removeAttribute('data-canvas-minimap-expanded')
}

/** Close the expanded map — keeps the live camera (pan/zoom) as-is. */
export function closeCanvasMinimap(): void {
  const minimap = useCanvasMinimapStore.getState()
  if (!minimap.expandedOpen) return

  playSound('minimapClose')
  minimap.setRepositionHintOpen(false)
  minimap.setExpandedOpen(false)
}

/** Escape — close the expanded map and leave fisheye at the current viewport. */
export function dismissMinimapMode(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
): void {
  closeCanvasMinimap()
  if (useCanvasFisheyeStore.getState().engaged) {
    runCanvasFisheyeExit(transformRef.current, null)
  }
}

/** Canvas map shortcut — open (entering fisheye if needed), or close when already open. */
export function toggleCanvasMinimap(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
): void {
  if (useCanvasMinimapStore.getState().expandedOpen) {
    closeCanvasMinimap()
    return
  }
  openCanvasMinimap(transformRef)
}

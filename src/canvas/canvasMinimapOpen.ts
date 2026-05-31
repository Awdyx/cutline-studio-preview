import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { playSound } from '../sound/playSound'
import {
  runCanvasOverviewEnter,
  runCanvasOverviewExit,
  toggleCanvasOverview,
} from './canvasOverviewCamera'
import { useCanvasOverviewStore } from './canvasOverviewStore'
import { useCanvasMinimapStore } from './canvasMinimapStore'

/** Expand the map overlay while overview is already active (collapsed minimap click). */
export function expandCanvasMinimap(): void {
  const minimap = useCanvasMinimapStore.getState()
  if (minimap.expandedOpen) return
  minimap.setRepositionHintOpen(false)
  minimap.setExpandedOpen(true)
  playSound('minimapOpen')
}

/** Open the expanded map from the studio reposition control (overview only). */
export function openCanvasMinimapFromReposition(): void {
  if (!useCanvasOverviewStore.getState().engaged) return
  const minimap = useCanvasMinimapStore.getState()
  if (minimap.expandedOpen) return
  minimap.setRepositionHintOpen(true)
  minimap.setExpandedOpen(true)
  playSound('minimapOpen')
}

/** Open the expanded canvas map, entering overview first when needed. */
export function openCanvasMinimap(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
): void {
  if (!useCanvasOverviewStore.getState().engaged) {
    runCanvasOverviewEnter(transformRef.current, null)
  }
  const minimap = useCanvasMinimapStore.getState()
  minimap.setRepositionHintOpen(false)
  minimap.setExpandedOpen(true)
  playSound('minimapOpen')
}

/** Open the map only while overview is already active (e.g. right-click void). */
export function openCanvasMinimapFromOverview(): boolean {
  if (!useCanvasOverviewStore.getState().engaged) return false
  const minimap = useCanvasMinimapStore.getState()
  minimap.setRepositionHintOpen(false)
  minimap.setExpandedOpen(true)
  playSound('minimapOpen')
  return true
}

/** Drop expanded-map UI when leaving overview. */
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

/** Escape closes the expanded map and leaves overview at the current viewport. */
export function dismissMinimapMode(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
): void {
  closeCanvasMinimap()
  if (useCanvasOverviewStore.getState().engaged) {
    runCanvasOverviewExit(transformRef.current, null)
  }
}

/** Canvas map shortcut: toggle overview, or close the expanded map when open. */
export function toggleCanvasMinimap(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
): void {
  if (useCanvasMinimapStore.getState().expandedOpen) {
    closeCanvasMinimap()
    return
  }
  toggleCanvasOverview(transformRef.current, null)
}

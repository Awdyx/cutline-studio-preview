import { isStudyHubMenuFocusActive } from '../canvasItems/studyHubMenuFocus'
import { isPointInAnyCanvasPlateAcousticsZone } from '../canvas/canvasPlate'
import { useCanvasFisheyeStore } from '../canvas/canvasFisheyeStore'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import {
  backgroundMusic,
  type BackgroundMusicAcousticsMode,
} from './backgroundMusic'

let lastMode: BackgroundMusicAcousticsMode | null = null
/** Last sampled main-canvas viewport position relative to the acoustics zone. */
let lastViewportInAcousticsZone: boolean | null = null

export type BackgroundMusicAcousticsSyncOptions = {
  viewportCenter?: { x: number; y: number } | null
}

function sampleViewportAcousticsZone(
  center: { x: number; y: number } | null | undefined,
): void {
  if (
    !center ||
    !Number.isFinite(center.x) ||
    !Number.isFinite(center.y)
  ) {
    return
  }
  lastViewportInAcousticsZone = isPointInAnyCanvasPlateAcousticsZone(
    center.x,
    center.y,
  )
}

/** Main canvas — wait for a viewport sample before assuming open acoustics. */
function shouldDeferMainCanvasAcousticsSync(): boolean {
  const workspace = useCanvasWorkspaceStore.getState()
  if (workspace.canvasSwapMode != null) return false
  if (workspace.isInsideSpace()) return false
  if (isStudyHubMenuFocusActive()) return false
  if (useCanvasFisheyeStore.getState().engaged) return false
  return lastViewportInAcousticsZone === null
}

/** Resolve ambient music acoustics from workspace, fisheye, and viewport position. */
export function resolveBackgroundMusicAcousticsMode(
  opts?: BackgroundMusicAcousticsSyncOptions,
): BackgroundMusicAcousticsMode {
  const workspace = useCanvasWorkspaceStore.getState()
  const center = opts?.viewportCenter

  if (
    center &&
    Number.isFinite(center.x) &&
    Number.isFinite(center.y) &&
    !workspace.isInsideSpace()
  ) {
    sampleViewportAcousticsZone(center)
  }

  if (workspace.canvasSwapMode === 'enter') return 'enclosed'
  if (workspace.canvasSwapMode === 'exit') return 'open'
  if (workspace.isInsideSpace() || isStudyHubMenuFocusActive()) return 'enclosed'

  if (useCanvasFisheyeStore.getState().engaged) return 'open'

  if (lastViewportInAcousticsZone === false) return 'distant'

  return 'open'
}

export function syncBackgroundMusicAcoustics(
  opts?: BackgroundMusicAcousticsSyncOptions,
): void {
  if (shouldDeferMainCanvasAcousticsSync()) return

  const next = resolveBackgroundMusicAcousticsMode(opts)
  const modeChanged = next !== lastMode
  lastMode = next
  if (modeChanged || backgroundMusic.getAcousticsMode() !== next) {
    backgroundMusic.setAcousticsMode(next)
  }
}

/** @deprecated Use syncBackgroundMusicAcoustics */
export function syncBackgroundMusicEnclosedAcoustics(
  opts?: BackgroundMusicAcousticsSyncOptions,
): void {
  syncBackgroundMusicAcoustics(opts)
}

/** Reset cached sync state (e.g. after music stops). */
export function resetBackgroundMusicAcousticsCache(): void {
  lastMode = null
  lastViewportInAcousticsZone = null
}

/** Drop the last viewport sample so acoustics re-resolve after camera restore. */
export function invalidateBackgroundMusicAcousticsViewportSample(): void {
  lastViewportInAcousticsZone = null
}

/** @deprecated Use resetBackgroundMusicAcousticsCache */
export function resetBackgroundMusicEnclosedAcousticsCache(): void {
  resetBackgroundMusicAcousticsCache()
}

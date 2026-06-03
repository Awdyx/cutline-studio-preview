import { isStudyHubMenuFocusActive } from '../canvasItems/studyHubMenuFocus'
import { isPointInAnyCanvasPlateAcousticsZone } from '../canvas/canvasPlate'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import {
  backgroundMusic,
  type BackgroundMusicAcousticsMode,
} from './backgroundMusic'

let lastMode: BackgroundMusicAcousticsMode | null = null
/** Last sampled main-canvas viewport position relative to the acoustics zone. */
let lastViewportInAcousticsZone: boolean | null = null
let candidateViewportInAcousticsZone: boolean | null = null
let candidateViewportSinceMs = 0

/** Avoid seam thrash while panning across acoustics boundaries. */
const ACOUSTICS_ZONE_ENTER_HOLD_MS = 70
const ACOUSTICS_ZONE_EXIT_HOLD_MS = 180

export type BackgroundMusicAcousticsSyncOptions = {
  viewportCenter?: { x: number; y: number } | null
}

export type BackgroundMusicAcousticsDebugState = {
  lastMode: BackgroundMusicAcousticsMode | null
  currentMode: BackgroundMusicAcousticsMode
  lastViewportInAcousticsZone: boolean | null
  candidateViewportInAcousticsZone: boolean | null
  candidateViewportSinceMs: number
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
  const rawInZone = isPointInAnyCanvasPlateAcousticsZone(center.x, center.y)
  if (lastViewportInAcousticsZone === null) {
    lastViewportInAcousticsZone = rawInZone
    candidateViewportInAcousticsZone = null
    return
  }

  if (rawInZone === lastViewportInAcousticsZone) {
    candidateViewportInAcousticsZone = null
    return
  }

  const nowMs =
    typeof performance !== 'undefined' ? performance.now() : Date.now()
  if (candidateViewportInAcousticsZone !== rawInZone) {
    candidateViewportInAcousticsZone = rawInZone
    candidateViewportSinceMs = nowMs
    return
  }

  const holdMs = rawInZone
    ? ACOUSTICS_ZONE_ENTER_HOLD_MS
    : ACOUSTICS_ZONE_EXIT_HOLD_MS
  if (nowMs - candidateViewportSinceMs >= holdMs) {
    lastViewportInAcousticsZone = rawInZone
    candidateViewportInAcousticsZone = null
  }
}

/** Main canvas — wait for a viewport sample before assuming open acoustics. */
function shouldDeferMainCanvasAcousticsSync(): boolean {
  const workspace = useCanvasWorkspaceStore.getState()
  if (workspace.canvasSwapMode != null) return false
  if (workspace.isInsideSpace()) return false
  if (isStudyHubMenuFocusActive()) return false
  if (lastViewportInAcousticsZone !== null) return false
  return !(
    backgroundMusic.getAcousticsMode() === 'enclosed' &&
    !workspace.isInsideSpace() &&
    !isStudyHubMenuFocusActive()
  )
}

/** Resolve ambient music acoustics from workspace and viewport position. */
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
  candidateViewportInAcousticsZone = null
  candidateViewportSinceMs = 0
}

/** Drop the last viewport sample so acoustics re-resolve after camera restore. */
export function invalidateBackgroundMusicAcousticsViewportSample(): void {
  lastViewportInAcousticsZone = null
  candidateViewportInAcousticsZone = null
  candidateViewportSinceMs = 0
}

/** Debug-only snapshot for in-app diagnostics overlays. */
export function readBackgroundMusicAcousticsDebugState(): BackgroundMusicAcousticsDebugState {
  return {
    lastMode,
    currentMode: backgroundMusic.getAcousticsMode(),
    lastViewportInAcousticsZone,
    candidateViewportInAcousticsZone,
    candidateViewportSinceMs,
  }
}

/** @deprecated Use resetBackgroundMusicAcousticsCache */
export function resetBackgroundMusicEnclosedAcousticsCache(): void {
  resetBackgroundMusicAcousticsCache()
}

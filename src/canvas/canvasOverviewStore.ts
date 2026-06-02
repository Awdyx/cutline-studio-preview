import { create } from 'zustand'
import { syncBackgroundMusicAcoustics } from '../sound/backgroundMusicAcoustics'
import type { SpaceCamera } from '../spaces/types'

export type OverviewLayoutHandoff =
  | { mode: 'enter'; virtual: SpaceCamera; onComplete?: () => void }
  | { mode: 'exit'; library: SpaceCamera; onComplete?: () => void }

/** Brief hold after overview exit — suppresses layout animations while coords settle. */
export const OVERVIEW_EXIT_SETTLE_MS = 640
/** Crossfade duration for frosted ↔ solid on overview enter/exit. */
export const OVERVIEW_FROST_CROSSFADE_MS = 320
/** Final segment of exit settle — crossfade solid surfaces back to frosted glass. */
export const OVERVIEW_EXIT_FROST_REVEAL_MS = OVERVIEW_FROST_CROSSFADE_MS
/** Opening segment of overview enter — crossfade frosted surfaces to solid. */
export const OVERVIEW_ENTER_FROST_CONCEAL_MS = OVERVIEW_FROST_CROSSFADE_MS

const EXIT_SETTLE_ATTRS = [
  'data-canvas-overview-exit-settling',
  'data-canvas-overview-frost-reveal',
  'data-canvas-overview-frost-reveal-active',
  'data-canvas-overview-chrome-reveal',
  'data-canvas-overview-chrome-reveal-active',
] as const

let exitSettleTimerIds: ReturnType<typeof window.setTimeout>[] = []
let exitSettleRafId = 0

function clearExitSettleTimers(): void {
  for (const id of exitSettleTimerIds) window.clearTimeout(id)
  exitSettleTimerIds = []
  if (exitSettleRafId) {
    cancelAnimationFrame(exitSettleRafId)
    exitSettleRafId = 0
  }
}

function clearExitSettleDocumentAttrs(): void {
  const root = document.documentElement
  for (const attr of EXIT_SETTLE_ATTRS) {
    root.removeAttribute(attr)
  }
}

interface CanvasOverviewState {
  /** True while the zoomed-out canvas overview is active. */
  engaged: boolean
  /** Enter/exit zoom animation in flight — relaxes transform scale limits. */
  transitioning: boolean
  /** Studio-sized compositor + viewport-fixed void (overview hyper path). */
  hyperOptimized: boolean
  /** Pending DOM resize + camera conversion — applied in useLayoutEffect before paint. */
  layoutHandoff: OverviewLayoutHandoff | null
  /** Post-exit settle — Framer layout + frosted glass stay frozen briefly. */
  exitSettling: boolean
  setEngaged: (engaged: boolean) => void
  setTransitioning: (transitioning: boolean) => void
  setHyperOptimized: (hyperOptimized: boolean) => void
  setLayoutHandoff: (handoff: OverviewLayoutHandoff | null) => void
  /** Atomically toggle hyper DOM + queue camera handoff (single render). */
  commitHyperLayoutHandoff: (
    hyperOptimized: boolean,
    handoff: OverviewLayoutHandoff | null,
  ) => void
  /** Abort post-exit settle timers (fast re-enter / reversed toggle). */
  cancelExitSettling: () => void
  beginExitSettling: () => void
  /** Animate frosted canvas widgets to solid at the start of overview enter. */
  beginEnterFrostConceal: () => void
  /** Atomically engage overview + queue hyper layout handoff (single store update). */
  beginOverviewEnter: (
    handoff: OverviewLayoutHandoff | null,
    hyperOptimized: boolean,
  ) => void
}

/** Skip layout-driven camera restore while overview owns the transform. */
export function shouldDeferLayoutCameraApply(): boolean {
  const { engaged, transitioning, hyperOptimized, layoutHandoff, exitSettling } =
    useCanvasOverviewStore.getState()
  return (
    engaged || transitioning || hyperOptimized || layoutHandoff != null || exitSettling
  )
}

export const useCanvasOverviewStore = create<CanvasOverviewState>((set, get) => ({
  engaged: false,
  transitioning: false,
  hyperOptimized: false,
  layoutHandoff: null,
  exitSettling: false,
  setEngaged: (engaged) => {
    if (get().engaged === engaged) return
    const root = document.documentElement
    if (engaged) {
      root.setAttribute('data-fisheye-engaged', '')
    } else {
      root.removeAttribute('data-fisheye-engaged')
      root.removeAttribute('data-canvas-overview-exiting')
    }
    set({ engaged })
    syncBackgroundMusicAcoustics()
  },
  setTransitioning: (transitioning) => {
    if (get().transitioning === transitioning) return
    const root = document.documentElement
    if (transitioning) {
      root.setAttribute('data-canvas-overview-transitioning', '')
    } else {
      root.removeAttribute('data-canvas-overview-transitioning')
    }
    set({ transitioning })
  },
  setHyperOptimized: (hyperOptimized) => {
    if (get().hyperOptimized === hyperOptimized) return
    set({ hyperOptimized })
  },
  setLayoutHandoff: (layoutHandoff) => {
    if (get().layoutHandoff === layoutHandoff) return
    set({ layoutHandoff })
  },
  commitHyperLayoutHandoff: (hyperOptimized, layoutHandoff) => {
    const prev = get()
    if (
      prev.hyperOptimized === hyperOptimized &&
      prev.layoutHandoff === layoutHandoff
    ) {
      return
    }
    set({ hyperOptimized, layoutHandoff })
  },
  beginEnterFrostConceal: () => {
    document.documentElement.setAttribute('data-canvas-overview-frost-conceal', '')
    requestAnimationFrame(() => {
      document.documentElement.setAttribute(
        'data-canvas-overview-frost-conceal-active',
        '',
      )
    })
    window.setTimeout(() => {
      document.documentElement.removeAttribute(
        'data-canvas-overview-frost-conceal-active',
      )
      document.documentElement.removeAttribute('data-canvas-overview-frost-conceal')
    }, OVERVIEW_ENTER_FROST_CONCEAL_MS)
  },
  beginOverviewEnter: (layoutHandoff, hyperOptimized) => {
    get().cancelExitSettling()
    get().beginEnterFrostConceal()

    const root = document.documentElement
    root.setAttribute('data-fisheye-engaged', '')
    root.removeAttribute('data-canvas-overview-exiting')
    root.setAttribute('data-canvas-overview-transitioning', '')

    set({
      engaged: true,
      transitioning: true,
      hyperOptimized,
      layoutHandoff,
    })
    syncBackgroundMusicAcoustics()
  },
  cancelExitSettling: () => {
    clearExitSettleTimers()
    clearExitSettleDocumentAttrs()
    if (!get().exitSettling) return
    set({ exitSettling: false })
  },
  beginExitSettling: () => {
    if (get().exitSettling) return
    clearExitSettleTimers()
    set({ exitSettling: true })
    document.documentElement.setAttribute('data-canvas-overview-exit-settling', '')

    const frostRevealStartMs = Math.max(
      0,
      OVERVIEW_EXIT_SETTLE_MS - OVERVIEW_EXIT_FROST_REVEAL_MS,
    )

    exitSettleTimerIds.push(
      window.setTimeout(() => {
        if (!get().exitSettling) return
        document.documentElement.removeAttribute('data-canvas-overview-exit-settling')
        document.documentElement.setAttribute('data-canvas-overview-frost-reveal', '')
        exitSettleRafId = requestAnimationFrame(() => {
          exitSettleRafId = 0
          if (!get().exitSettling) return
          document.documentElement.setAttribute(
            'data-canvas-overview-frost-reveal-active',
            '',
          )
        })
      }, frostRevealStartMs),
    )

    exitSettleTimerIds.push(
      window.setTimeout(() => {
        if (!get().exitSettling) return
        set({ exitSettling: false })
        document.documentElement.removeAttribute('data-canvas-overview-frost-reveal-active')
        document.documentElement.removeAttribute('data-canvas-overview-frost-reveal')
        document.documentElement.setAttribute('data-canvas-overview-chrome-reveal', '')
        get().setEngaged(false)
        exitSettleRafId = requestAnimationFrame(() => {
          exitSettleRafId = 0
          if (
            !document.documentElement.hasAttribute('data-canvas-overview-chrome-reveal')
          ) {
            return
          }
          document.documentElement.setAttribute(
            'data-canvas-overview-chrome-reveal-active',
            '',
          )
        })
        exitSettleTimerIds.push(
          window.setTimeout(() => {
            document.documentElement.removeAttribute(
              'data-canvas-overview-chrome-reveal-active',
            )
            document.documentElement.removeAttribute('data-canvas-overview-chrome-reveal')
          }, 480),
        )
      }, OVERVIEW_EXIT_SETTLE_MS),
    )
  },
}))

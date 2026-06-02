import { create } from 'zustand'
import {
  defaultPocketStripState,
  pocketStripVisualScale,
  POCKET_STRIP_DEFAULT_LOGICAL_WIDTH,
} from './pocketStripDimensions'
import type { PocketStripState } from './types'

type PocketStripRuntimeState = {
  logicalWidth: number
  scrollY: number
  viewportWidth: number
  viewportHeight: number
  scale: number
  scrollHost: HTMLElement | null
  setScrollHost: (el: HTMLElement | null) => void
  applyStripState: (strip: PocketStripState, viewportWidth: number, viewportHeight: number) => void
  setScrollY: (scrollY: number) => void
  setViewportSize: (width: number, height: number) => void
  reset: () => void
}

export const usePocketStripStore = create<PocketStripRuntimeState>((set, get) => ({
  logicalWidth: POCKET_STRIP_DEFAULT_LOGICAL_WIDTH,
  scrollY: 0,
  viewportWidth: POCKET_STRIP_DEFAULT_LOGICAL_WIDTH,
  viewportHeight: 800,
  scale: 1,
  scrollHost: null,
  setScrollHost: (scrollHost) => set({ scrollHost }),
  applyStripState: (strip, viewportWidth, viewportHeight) => {
    const logicalWidth = strip.logicalWidth
    set({
      logicalWidth,
      scrollY: strip.scrollY,
      viewportWidth,
      viewportHeight,
      scale: pocketStripVisualScale(logicalWidth, viewportWidth),
    })
  },
  setScrollY: (scrollY) => set({ scrollY }),
  setViewportSize: (viewportWidth, viewportHeight) => {
    const { logicalWidth } = get()
    set({
      viewportWidth,
      viewportHeight,
      scale: pocketStripVisualScale(logicalWidth, viewportWidth),
    })
  },
  reset: () => {
    const defaults = defaultPocketStripState()
    set({
      logicalWidth: defaults.logicalWidth,
      scrollY: 0,
      viewportWidth: POCKET_STRIP_DEFAULT_LOGICAL_WIDTH,
      viewportHeight: 800,
      scale: 1,
      scrollHost: null,
    })
  },
}))

export function readPocketStripState(): PocketStripState {
  const { logicalWidth, scrollY } = usePocketStripStore.getState()
  return { logicalWidth, scrollY }
}

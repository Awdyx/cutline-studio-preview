import { useCallback, useLayoutEffect, useRef } from 'react'
import { useCanvasWorkspaceStore } from './canvasWorkspaceStore'
import {
  defaultPocketStripState,
  pocketStripScrollTopFromScrollY,
  pocketStripScrollYFromScrollTop,
  pocketStripVisualScale,
  POCKET_STRIP_VIRTUAL_HEIGHT,
} from './pocketStripDimensions'
import { readPocketStripState, usePocketStripStore } from './pocketStripStore'
import type { PocketStripState } from './types'

function applyScrollTopToHost(
  host: HTMLElement,
  scrollY: number,
  viewportWidth: number,
  viewportHeight: number,
  logicalWidth: number,
): void {
  const scale = pocketStripVisualScale(logicalWidth, viewportWidth)
  host.scrollTop = pocketStripScrollTopFromScrollY(scrollY, viewportHeight, scale)
}

export function usePocketStripScroll(
  viewportWidth: number,
  viewportHeight: number,
  activeSpaceId: string | null,
) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const applyingScrollRef = useRef(false)
  const setScrollHost = usePocketStripStore((s) => s.setScrollHost)
  const applyStripState = usePocketStripStore((s) => s.applyStripState)
  const setScrollY = usePocketStripStore((s) => s.setScrollY)
  const setViewportSize = usePocketStripStore((s) => s.setViewportSize)
  const scrollHost = usePocketStripStore((s) => s.scrollHost)
  const saveStripForActive = useCanvasWorkspaceStore((s) => s.saveStripForActive)
  const savedScrollY = useCanvasWorkspaceStore((s) =>
    activeSpaceId ? (s.spaces[activeSpaceId]?.strip?.scrollY ?? 0) : 0,
  )

  const readStripForSpace = useCallback((): PocketStripState => {
    if (!activeSpaceId) return defaultPocketStripState(viewportWidth)
    const space = useCanvasWorkspaceStore.getState().spaces[activeSpaceId]
    if (space?.strip) return space.strip
    return defaultPocketStripState(viewportWidth)
  }, [activeSpaceId, viewportWidth])

  useLayoutEffect(() => {
    setViewportSize(viewportWidth, viewportHeight)
  }, [viewportWidth, viewportHeight, setViewportSize])

  useLayoutEffect(() => {
    if (!activeSpaceId) return
    const strip = readStripForSpace()
    const nextStrip = {
      scrollY: strip.scrollY,
      logicalWidth: Math.max(strip.logicalWidth, Math.round(viewportWidth)),
    }
    if (nextStrip.logicalWidth !== strip.logicalWidth) {
      useCanvasWorkspaceStore.getState().saveStripForActive(nextStrip)
    }
    applyStripState(nextStrip, viewportWidth, viewportHeight)
  }, [
    activeSpaceId,
    savedScrollY,
    viewportWidth,
    viewportHeight,
    readStripForSpace,
    applyStripState,
  ])

  useLayoutEffect(() => {
    if (!activeSpaceId) return
    const host = scrollRef.current ?? scrollHost
    if (!host || viewportWidth <= 0 || viewportHeight <= 0) return

    const { logicalWidth, scrollY } = readPocketStripState()
    applyingScrollRef.current = true
    applyScrollTopToHost(
      host,
      scrollY,
      viewportWidth,
      viewportHeight,
      logicalWidth,
    )
    requestAnimationFrame(() => {
      applyingScrollRef.current = false
    })
  }, [
    activeSpaceId,
    savedScrollY,
    scrollHost,
    viewportWidth,
    viewportHeight,
  ])

  useLayoutEffect(() => {
    setScrollHost(scrollRef.current)
    return () => setScrollHost(null)
  }, [setScrollHost, activeSpaceId])

  const onScroll = useCallback(() => {
    if (applyingScrollRef.current) return
    const host = scrollRef.current
    if (!host) return
    const { logicalWidth } = readPocketStripState()
    const scale = pocketStripVisualScale(logicalWidth, viewportWidth)
    const scrollY = pocketStripScrollYFromScrollTop(
      host.scrollTop,
      viewportHeight,
      scale,
    )
    setScrollY(scrollY)
    saveStripForActive({ logicalWidth, scrollY })
  }, [viewportWidth, viewportHeight, setScrollY, saveStripForActive])

  const visualScale = usePocketStripStore((s) => s.scale)
  const logicalWidth = usePocketStripStore((s) => s.logicalWidth)
  const scrollContentHeight = POCKET_STRIP_VIRTUAL_HEIGHT * visualScale

  return {
    scrollRef,
    onScroll,
    visualScale,
    logicalWidth,
    scrollContentHeight,
  }
}

export function applyPocketStripScrollNow(
  scrollY: number,
  viewportWidth: number,
  viewportHeight: number,
  logicalWidth: number,
): void {
  const host = usePocketStripStore.getState().scrollHost
  if (!host) return
  applyingScrollRefHack = true
  applyScrollTopToHost(host, scrollY, viewportWidth, viewportHeight, logicalWidth)
  requestAnimationFrame(() => {
    applyingScrollRefHack = false
  })
}

let applyingScrollRefHack = false

export function isApplyingPocketStripScroll(): boolean {
  return applyingScrollRefHack
}

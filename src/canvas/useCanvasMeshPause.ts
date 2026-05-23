import { useLayoutEffect, useRef } from 'react'

/** Matches pen/+ FAB menu open/close animation (~180ms). */
const CHROME_ANIM_MS = 220

let pauseCount = 0

function syncPauseAttribute() {
  const root = document.documentElement
  if (pauseCount > 0) root.setAttribute('data-pause-mesh', '')
  else root.removeAttribute('data-pause-mesh')
}

function holdMeshPause(): () => void {
  pauseCount += 1
  syncPauseAttribute()
  return () => {
    pauseCount = Math.max(0, pauseCount - 1)
    syncPauseAttribute()
  }
}

/**
 * Freeze animated canvas mesh while frosted chrome animates.
 * Animated mesh invalidates the pan/zoom compositor layer every frame; pausing
 * during FAB open/close avoids re-sampling a moving backdrop (especially before
 * the layer is warmed by a space transition opacity fade).
 */
/** Pause mesh before the next paint (call synchronously when opening chrome). */
export function holdMeshPauseSync(): () => void {
  return holdMeshPause()
}

export function useCanvasMeshPauseWhile(active: boolean) {
  const wasActiveRef = useRef(false)

  useLayoutEffect(() => {
    if (active) {
      wasActiveRef.current = true
      return holdMeshPause()
    }

    if (!wasActiveRef.current) return
    wasActiveRef.current = false

    const release = holdMeshPause()
    const timer = window.setTimeout(release, CHROME_ANIM_MS)
    return () => {
      window.clearTimeout(timer)
      release()
    }
  }, [active])
}

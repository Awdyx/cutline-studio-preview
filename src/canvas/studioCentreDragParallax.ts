/** Subtle void/ramp shift while repositioning the studio centre (canvas-space deltas). */

const PARALLAX_FACTOR = 0.062
const ROOT = document.documentElement
const PARALLAX_ACTIVE_ATTR = 'data-studio-centre-parallax-active'

function parallaxMotionAllowed(): boolean {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function armStudioCentreDragParallax(): void {
  if (!parallaxMotionAllowed()) return
  ROOT.setAttribute(PARALLAX_ACTIVE_ATTR, '')
}

export function syncStudioCentreDragParallax(dxCanvas: number, dyCanvas: number): void {
  if (!parallaxMotionAllowed()) return
  ROOT.style.setProperty('--studio-centre-parallax-x', `${dxCanvas * PARALLAX_FACTOR}px`)
  ROOT.style.setProperty('--studio-centre-parallax-y', `${dyCanvas * PARALLAX_FACTOR}px`)
}

/** Pointer-up — ease the void back while the studio slab commits / springs. */
export function settleStudioCentreDragParallax(): void {
  ROOT.removeAttribute(PARALLAX_ACTIVE_ATTR)
  requestAnimationFrame(() => {
    ROOT.style.setProperty('--studio-centre-parallax-x', '0px')
    ROOT.style.setProperty('--studio-centre-parallax-y', '0px')
  })
}

export function clearStudioCentreDragParallax(): void {
  ROOT.removeAttribute(PARALLAX_ACTIVE_ATTR)
  ROOT.style.removeProperty('--studio-centre-parallax-x')
  ROOT.style.removeProperty('--studio-centre-parallax-y')
}

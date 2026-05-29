import type { CSSProperties } from 'react'

export const PAN_EDGE_KEYS = ['left', 'right', 'top', 'bottom'] as const
export type PanEdgeKey = (typeof PAN_EDGE_KEYS)[number]

/** Opaque glow blobs + blur — no alpha gradients, so no banding. Opacity animates for direction. */
export function panEdgeOverlayStyle(key: PanEdgeKey): CSSProperties {
  const base: CSSProperties = {
    position: 'fixed',
    pointerEvents: 'none',
    zIndex: 9,
    background: 'var(--pan-edge-glow)',
    filter: 'blur(22px)',
    willChange: 'opacity',
  }

  switch (key) {
    case 'left':
      return {
        ...base,
        left: 0,
        top: '50%',
        width: 52,
        height: '100%',
        transform: 'translate(-82%, -50%)',
      }
    case 'right':
      return {
        ...base,
        left: '100%',
        top: '50%',
        width: 52,
        height: '100%',
        transform: 'translate(-18%, -50%)',
      }
    case 'top':
      return {
        ...base,
        left: '50%',
        top: 0,
        width: '100%',
        height: 52,
        transform: 'translate(-50%, -82%)',
      }
    case 'bottom':
      return {
        ...base,
        left: '50%',
        top: '100%',
        width: '100%',
        height: 52,
        transform: 'translate(-50%, -18%)',
      }
  }
}

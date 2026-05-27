import { create } from 'zustand'
import {
  EMPTY_EDGE_STRENGTHS,
  MAX_VELOCITY,
  type EdgeStrengths,
} from './canvasPanVignette'

interface PanMotionState {
  vx: number
  vy: number
  intensity: number
  active: boolean
  zoomActive: boolean
  edges: EdgeStrengths
  zoomEdgeStrength: number
  setPanFrame: (vx: number, vy: number, edges: EdgeStrengths) => void
  setEdges: (edges: EdgeStrengths) => void
  setZoomEdgeStrength: (strength: number) => void
  setPanStopped: () => void
  setZoomActive: (active: boolean) => void
}

const EDGE_EPS = 0.001
const VEL_EPS = 0.001

function edgesEqual(a: EdgeStrengths, b: EdgeStrengths): boolean {
  return (
    Math.abs(a.top - b.top) < EDGE_EPS &&
    Math.abs(a.bottom - b.bottom) < EDGE_EPS &&
    Math.abs(a.left - b.left) < EDGE_EPS &&
    Math.abs(a.right - b.right) < EDGE_EPS
  )
}

export const usePanMotionStore = create<PanMotionState>((set, get) => ({
  vx: 0,
  vy: 0,
  intensity: 0,
  active: false,
  zoomActive: false,
  edges: EMPTY_EDGE_STRENGTHS,
  zoomEdgeStrength: 0,

  setPanFrame: (vx, vy, edges) => {
    const magnitude = Math.sqrt(vx * vx + vy * vy)
    const intensity = Math.min(magnitude / MAX_VELOCITY, 1)
    const active = magnitude > 0
    const s = get()
    if (
      Math.abs(s.vx - vx) < VEL_EPS &&
      Math.abs(s.vy - vy) < VEL_EPS &&
      Math.abs(s.intensity - intensity) < EDGE_EPS &&
      s.active === active &&
      edgesEqual(s.edges, edges)
    ) return
    set({ vx, vy, edges, intensity, active })
  },

  setEdges: (edges) => {
    if (edgesEqual(get().edges, edges)) return
    set({ edges })
  },

  setZoomEdgeStrength: (strength) => {
    if (Math.abs(get().zoomEdgeStrength - strength) < EDGE_EPS) return
    set({ zoomEdgeStrength: strength })
  },

  setPanStopped: () => {
    const s = get()
    if (!s.active && s.intensity === 0 && s.vx === 0 && s.vy === 0) return
    set({ active: false, intensity: 0, vx: 0, vy: 0 })
  },

  setZoomActive: (active: boolean) => {
    if (get().zoomActive === active) return
    set({ zoomActive: active })
  },
}))

export { MAX_VELOCITY } from './canvasPanVignette'

import type { FeaturePlateDestination } from './canvasPlate'

const impulses = new Map<FeaturePlateDestination, { dx: number; dy: number }>()

export function addFeaturePlateDragImpulse(
  dest: FeaturePlateDestination,
  dx: number,
  dy: number,
): void {
  if (dx === 0 && dy === 0) return
  const cur = impulses.get(dest) ?? { dx: 0, dy: 0 }
  impulses.set(dest, { dx: cur.dx + dx, dy: cur.dy + dy })
}

export function consumeFeaturePlateDragImpulse(dest: FeaturePlateDestination): {
  dx: number
  dy: number
} {
  const cur = impulses.get(dest) ?? { dx: 0, dy: 0 }
  impulses.set(dest, { dx: 0, dy: 0 })
  return cur
}

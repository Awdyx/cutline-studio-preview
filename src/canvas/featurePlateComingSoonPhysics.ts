import {
  FEATURE_PLATE_HEIGHT,
  FEATURE_PLATE_WIDTH,
} from '../drawing/canvasDimensions'

export type ComingSoonParticle = {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vRot: number
  scale: number
  variant: number
}

const LABELS = [
  'coming soon',
  'coming soon…',
  'coming soon!',
  'soon™',
  'coming soon coming soon',
] as const

const MARGIN = 48
const BOUNCE = 0.72
const DRAG_KICK = 0.42
const DAMPING = 0.988
const ROT_DAMP = 0.96

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function labelForVariant(variant: number): string {
  return LABELS[variant % LABELS.length] ?? LABELS[0]
}

export function createComingSoonParticles(count = 28): ComingSoonParticle[] {
  const w = FEATURE_PLATE_WIDTH
  const h = FEATURE_PLATE_HEIGHT
  const particles: ComingSoonParticle[] = []

  for (let i = 0; i < count; i++) {
    particles.push({
      x: rand(MARGIN, w - MARGIN),
      y: rand(MARGIN, h - MARGIN),
      vx: rand(-0.4, 0.4),
      vy: rand(-0.4, 0.4),
      rot: rand(-18, 18),
      vRot: rand(-0.6, 0.6),
      scale: rand(0.72, 1.18),
      variant: i % LABELS.length,
    })
  }
  return particles
}

export function labelForComingSoonParticle(p: ComingSoonParticle): string {
  return labelForVariant(p.variant)
}

export function stepComingSoonParticles(
  particles: ComingSoonParticle[],
  dragDx: number,
  dragDy: number,
): void {
  const w = FEATURE_PLATE_WIDTH
  const h = FEATURE_PLATE_HEIGHT
  const kickX = dragDx * DRAG_KICK
  const kickY = dragDy * DRAG_KICK

  for (const p of particles) {
    if (kickX !== 0 || kickY !== 0) {
      p.vx += kickX + rand(-0.8, 0.8)
      p.vy += kickY + rand(-0.8, 0.8)
      p.vRot += rand(-2.5, 2.5)
    }

    p.x += p.vx
    p.y += p.vy
    p.rot += p.vRot
    p.vx *= DAMPING
    p.vy *= DAMPING
    p.vRot *= ROT_DAMP

    const pad = MARGIN * 0.35
    if (p.x < pad) {
      p.x = pad
      p.vx = Math.abs(p.vx) * BOUNCE
    } else if (p.x > w - pad) {
      p.x = w - pad
      p.vx = -Math.abs(p.vx) * BOUNCE
    }
    if (p.y < pad) {
      p.y = pad
      p.vy = Math.abs(p.vy) * BOUNCE
    } else if (p.y > h - pad) {
      p.y = h - pad
      p.vy = -Math.abs(p.vy) * BOUNCE
    }
  }
}

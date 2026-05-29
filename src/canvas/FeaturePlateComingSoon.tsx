import { useEffect, useRef, useState } from 'react'
import type { FeaturePlateDestination } from './canvasPlate'
import { consumeFeaturePlateDragImpulse } from './featurePlateDragImpulse'
import {
  createComingSoonParticles,
  labelForComingSoonParticle,
  stepComingSoonParticles,
  type ComingSoonParticle,
} from './featurePlateComingSoonPhysics'

type Props = {
  destination: FeaturePlateDestination
}

export default function FeaturePlateComingSoon({ destination }: Props) {
  const [particles, setParticles] = useState<ComingSoonParticle[]>(() =>
    createComingSoonParticles(),
  )
  const particlesRef = useRef(particles)
  particlesRef.current = particles

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const { dx, dy } = consumeFeaturePlateDragImpulse(destination)

      stepComingSoonParticles(particlesRef.current, dx, dy)
      setParticles([...particlesRef.current])
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [destination])

  return (
    <div className="feature-plate-coming-soon" aria-hidden>
      {particles.map((p, i) => (
        <span
          key={i}
          className="feature-plate-coming-soon__label"
          style={{
            transform: `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg) scale(${p.scale})`,
          }}
        >
          {labelForComingSoonParticle(p)}
        </span>
      ))}
    </div>
  )
}

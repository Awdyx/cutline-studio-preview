/**
 * One-time radial displacement map for the screen-space barrel filter.
 * R encodes horizontal offset, G vertical — both sample toward the centre,
 * ramping with radius so the centre stays still and the bulge grows outward
 * while still filling the frame edge-to-edge (no exposed black border).
 */
export function buildBarrelDisplacementMapDataUrl(size = 512): string {
  if (typeof document === 'undefined') return ''
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const image = ctx.createImageData(size, size)
  const data = image.data
  const centre = (size - 1) / 2
  const maxR = Math.hypot(centre, centre)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - centre
      const dy = y - centre
      const r = Math.hypot(dx, dy) || 1e-6
      // r³ growth keeps the centre flat and concentrates the bulge near the
      // edges/corners — the characteristic CRT / fisheye curvature.
      const falloff = Math.min(1, (r / maxR) ** 3)
      const ux = dx / r
      const uy = dy / r
      // Inward sampling (toward centre): edge pixels read content from inside the
      // frame, so the bulge fills edge-to-edge instead of exposing black bars.
      const i = (y * size + x) * 4
      data[i] = Math.round((0.5 - ux * falloff * 0.5) * 255)
      data[i + 1] = Math.round((0.5 - uy * falloff * 0.5) * 255)
      data[i + 2] = 128
      data[i + 3] = 255
    }
  }

  ctx.putImageData(image, 0, 0)
  return canvas.toDataURL()
}

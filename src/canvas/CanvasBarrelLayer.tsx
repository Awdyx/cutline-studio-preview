import { useEffect, useMemo } from 'react'
import { CANVAS_BARREL_FILTER_ID } from './canvasBarrelStrength'
import { buildBarrelDisplacementMapDataUrl } from './canvasBarrelMap'
import { warmCanvasBarrelFilter } from './canvasBarrelPostProcess'

/**
 * Defines the screen-space barrel filter (a single feDisplacementMap fed by a
 * radial map). The filter is applied to the canvas host via CSS only while the
 * post-process is active, so it costs nothing when zoomed in.
 */
export default function CanvasBarrelLayer() {
  const mapUrl = useMemo(() => buildBarrelDisplacementMapDataUrl(), [])

  // Decode the displacement map and pre-build the filter once so the first
  // fisheye engage doesn't flash black edges before it has rasterised.
  useEffect(() => {
    if (!mapUrl) return
    let cancelled = false
    const warm = () => {
      if (!cancelled) warmCanvasBarrelFilter()
    }
    const img = new Image()
    img.src = mapUrl
    if (img.decode) {
      img.decode().then(warm, warm)
    } else {
      img.onload = warm
      img.onerror = warm
    }
    const fallback = window.setTimeout(warm, 400)
    return () => {
      cancelled = true
      window.clearTimeout(fallback)
    }
  }, [mapUrl])

  return (
    <svg aria-hidden width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        <filter
          id={CANVAS_BARREL_FILTER_ID}
          x="-5%"
          y="-5%"
          width="110%"
          height="110%"
          colorInterpolationFilters="sRGB"
        >
          <feImage
            href={mapUrl}
            preserveAspectRatio="none"
            result="barrelMap"
          />
          <feDisplacementMap
            id={`${CANVAS_BARREL_FILTER_ID}-map`}
            in="SourceGraphic"
            in2="barrelMap"
            scale="0"
            xChannelSelector="R"
            yChannelSelector="G"
            result="barrelWarped"
          />
          {/* Softens 1px edges / mask ramps after warp — very slight, fisheye-only. */}
          <feGaussianBlur in="barrelWarped" stdDeviation="0.85" />
        </filter>
      </defs>
    </svg>
  )
}

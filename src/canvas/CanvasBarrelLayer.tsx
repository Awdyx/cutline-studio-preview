import { useEffect, useState } from 'react'
import { CANVAS_BARREL_FILTER_ID } from './canvasBarrelStrength'
import { buildBarrelDisplacementMapDataUrl } from './canvasBarrelMap'
import {
  resetCanvasBarrelWarmState,
  warmCanvasBarrelFilter,
} from './canvasBarrelPostProcess'

/**
 * Defines the screen-space barrel filter (a single feDisplacementMap fed by a
 * radial map). The filter is applied to the canvas host via CSS only while the
 * post-process is active, so it costs nothing when zoomed in.
 */
export default function CanvasBarrelLayer() {
  const [mapUrl, setMapUrl] = useState('')

  useEffect(() => {
    const dataUrl = buildBarrelDisplacementMapDataUrl()
    if (dataUrl) setMapUrl(dataUrl)
  }, [])

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
      resetCanvasBarrelWarmState()
    }
  }, [mapUrl])

  if (!mapUrl) return null

  return (
    <svg
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      style={{
        position: 'absolute',
        width: 0,
        height: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
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
            xlinkHref={mapUrl}
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

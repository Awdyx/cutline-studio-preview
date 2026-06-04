import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useReducedMotion } from 'framer-motion'
import { useMediaBlobUrl } from '../hooks/useMediaBlobUrl'
import { mediaLoadOpacity, mediaLoadTransitionStyle } from '../components/MediaLoadPlaceholder'
import { useCanvasItemsStore, useItemSelected } from './canvasItemsStore'
import { useCanvasItemDragStore } from './canvasItemDragStore'
import { attachCanvasItemDragPointerDown } from './canvasItemDrag'
import { stickyEmbeddedImageCssZ } from './stickyImageLayers'
import {
  buildOverflowDistanceMask,
  buildOverflowPreviewLayout,
  embeddedImageOverflowUnion,
} from './stickyOverflowPreview'
import { isImageInSticky, type ImageCanvasItem } from './types'
import {
  useCanvasCustomizeExiting,
  useCanvasCustomizeItemHandoff,
  useCanvasCustomizeStore,
} from '../canvasItemCustomize/canvasCustomizeStore'
import { useLassoStore } from '../drawing/useLassoStore'

const overflowEnter = { duration: 0.48, ease: [0.16, 1, 0.3, 1] as const }
const overflowExit = { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const }

const overflowFilteredStyle = {
  opacity: 0.42,
  filter: 'saturate(0.35) brightness(0.92) blur(1.5px)',
}

function OverflowImagePreview({
  image,
  stickyWidth,
  stickyHeight,
  interactive,
  fadeRevealed,
  customizeFadeOut,
  instant,
}: {
  image: ImageCanvasItem
  stickyWidth: number
  stickyHeight: number
  interactive: boolean
  fadeRevealed: boolean
  customizeFadeOut: boolean
  instant: boolean
}) {
  const { url, status } = useMediaBlobUrl(image.mediaId, image.id)
  const isDragging = useCanvasItemDragStore((s) => s.activeItemId === image.id)

  const stickyBounds = useMemo(
    () => ({ width: stickyWidth, height: stickyHeight }),
    [stickyWidth, stickyHeight],
  )

  const layout = useMemo(
    () => buildOverflowPreviewLayout(image, stickyBounds),
    [image, stickyBounds],
  )

  const distanceMask = useMemo(() => {
    if (!layout) return null
    return buildOverflowDistanceMask(layout.union, image, stickyBounds)
  }, [image, layout, stickyBounds])

  const onOverflowPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!interactive) return
      attachCanvasItemDragPointerDown(image.id, e)
    },
    [image.id, interactive],
  )

  if (!url || !layout || !distanceMask) return null

  const { union, clipPath } = layout
  const fadeEase = fadeRevealed ? overflowEnter.ease : overflowExit.ease
  const fadeDuration = customizeFadeOut && !fadeRevealed ? 0.6 : fadeRevealed ? overflowEnter.duration : overflowExit.duration

  return (
    <div
      aria-hidden
      data-item-id={image.id}
      onPointerDown={interactive ? onOverflowPointerDown : undefined}
      style={{
        position: 'absolute',
        left: union.x,
        top: union.y,
        width: union.width,
        height: union.height,
        zIndex: stickyEmbeddedImageCssZ(image.zIndex),
        overflow: 'hidden',
        clipPath,
        WebkitClipPath: clipPath,
        opacity: fadeRevealed ? 1 : 0,
        transition: instant
          ? 'none'
          : `opacity ${fadeDuration}s cubic-bezier(${fadeEase.join(', ')})`,
        touchAction: interactive ? 'none' : undefined,
        cursor: interactive ? (isDragging ? 'grabbing' : 'grab') : undefined,
        pointerEvents: interactive ? 'auto' : 'none',
        WebkitMaskImage: distanceMask.maskImage,
        maskImage: distanceMask.maskImage,
        WebkitMaskComposite: distanceMask.webkitMaskComposite,
        maskComposite: distanceMask.maskComposite,
        WebkitMaskSize: '100% 100%',
        maskSize: '100% 100%',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          ...overflowFilteredStyle,
        }}
      >
        <img
          src={url}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            left: image.x - union.x,
            top: image.y - union.y,
            width: image.width,
            height: image.height,
            objectFit: 'fill',
            display: 'block',
            pointerEvents: 'none',
            opacity: url ? 1 : mediaLoadOpacity(status),
            ...(url ? {} : mediaLoadTransitionStyle()),
          }}
        />
      </div>
    </div>
  )
}

export default function StickyEmbeddedImageOverflow({
  stickyId,
  stickyWidth,
  stickyHeight,
  interactive = false,
}: {
  stickyId: string
  stickyWidth: number
  stickyHeight: number
  /** Allow dragging embedded images from their outside-the-sticky previews. */
  interactive?: boolean
}) {
  const items = useCanvasItemsStore((s) => s.items)
  const selectedIds = useCanvasItemsStore((s) => s.selectedIds)
  const stickySelected = useItemSelected(stickyId)
  const stickyCustomizeHandoff = useCanvasCustomizeItemHandoff(stickyId)
  const customizeHideReady = useCanvasCustomizeStore(
    (s) => s.itemId === stickyId && s.enterCanvasHideReady,
  )
  const stickyLassoSelected = useLassoStore((s) => s.selectedItemIds.includes(stickyId))
  const reduceMotion = useReducedMotion()

  const sorted = useMemo(
    () =>
      items
        .filter(
          (item): item is ImageCanvasItem =>
            item.type === 'image' &&
            isImageInSticky(item) &&
            item.stickyId === stickyId,
        )
        .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id)),
    [items, stickyId],
  )

  const stickyBounds = useMemo(
    () => ({ width: stickyWidth, height: stickyHeight }),
    [stickyWidth, stickyHeight],
  )

  const hasOverflow = useMemo(
    () => sorted.some((image) => embeddedImageOverflowUnion(image, stickyBounds) != null),
    [sorted, stickyBounds],
  )

  const anyImageSelected = sorted.some((image) => selectedIds.includes(image.id))
  const active = stickySelected || anyImageSelected
  const customizeExiting = useCanvasCustomizeExiting(stickyId)
  const overflowRevealed = active && hasOverflow && !customizeExiting
  const overflowInteractive =
    interactive && overflowRevealed && !stickyCustomizeHandoff && !stickyLassoSelected
  const instant = reduceMotion
  const [fadeRevealed, setFadeRevealed] = useState(overflowRevealed)

  // CSS opacity transition — rAF ensures fade-in always starts from 0 (not first-paint snap).
  useLayoutEffect(() => {
    if (instant) {
      setFadeRevealed(overflowRevealed && !stickyCustomizeHandoff)
      return
    }
    if (stickyCustomizeHandoff && !customizeHideReady) return
    if (stickyCustomizeHandoff) {
      if (!fadeRevealed) return
      const id = requestAnimationFrame(() => setFadeRevealed(false))
      return () => cancelAnimationFrame(id)
    }
    if (!overflowRevealed) {
      setFadeRevealed(false)
      return
    }
    if (fadeRevealed) return
    setFadeRevealed(false)
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setFadeRevealed(true))
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [overflowRevealed, instant, stickyCustomizeHandoff, customizeHideReady, hasOverflow, fadeRevealed])

  if (sorted.length === 0 || !hasOverflow) return null

  return (
    <div
      aria-hidden
      data-sticky-embedded-overflow=""
      data-lock-flatten-skip=""
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        overflow: 'visible',
        pointerEvents: 'none',
        opacity: 1,
      }}
    >
      {sorted.map((image) => (
        <OverflowImagePreview
          key={image.id}
          image={image}
          stickyWidth={stickyWidth}
          stickyHeight={stickyHeight}
          interactive={overflowInteractive}
          fadeRevealed={fadeRevealed}
          customizeFadeOut={stickyCustomizeHandoff}
          instant={instant}
        />
      ))}
    </div>
  )
}

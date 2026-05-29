import { motion } from 'framer-motion'
import { useMediaBlobUrl } from '../hooks/useMediaBlobUrl'
import { MEDIA_SATURATE, type ImageCanvasItem } from './types'

const ghostFollowSpring = {
  type: 'spring' as const,
  stiffness: 540,
  damping: 40,
  mass: 0.5,
}

const chromeEase = [0.4, 0, 0.2, 1] as const

export function StickyDropHoverChrome() {
  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: chromeEase }}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 4,
        borderRadius: 4,
        pointerEvents: 'none',
        boxShadow:
          'inset 0 0 0 1px color-mix(in srgb, var(--ui-text) 14%, transparent)',
        background:
          'linear-gradient(180deg, color-mix(in srgb, var(--ui-text) 4.5%, transparent) 0%, transparent 55%)',
      }}
    />
  )
}

export function StickyDropConfirmChrome() {
  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0] }}
      transition={{ duration: 0.34, ease: chromeEase, times: [0, 0.28, 1] }}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 4,
        borderRadius: 4,
        pointerEvents: 'none',
        boxShadow:
          'inset 0 0 0 1.5px color-mix(in srgb, var(--ui-text) 20%, transparent)',
        background: 'color-mix(in srgb, var(--ui-text) 5%, transparent)',
      }}
    />
  )
}

export function StickyDropGhost({
  ghost,
}: {
  ghost: Pick<ImageCanvasItem, 'mediaId' | 'id' | 'x' | 'y' | 'width' | 'height'>
}) {
  const { url, status } = useMediaBlobUrl(ghost.mediaId, ghost.id)
  if (!url || status !== 'ready') return null

  return (
    <motion.img
      src={url}
      alt=""
      draggable={false}
      initial={{ opacity: 0, scale: 0.968 }}
      animate={{
        opacity: 0.56,
        scale: 1,
        left: ghost.x,
        top: ghost.y,
        width: ghost.width,
        height: ghost.height,
      }}
      transition={{
        opacity: { duration: 0.24, ease: chromeEase },
        scale: ghostFollowSpring,
        left: ghostFollowSpring,
        top: ghostFollowSpring,
        width: { duration: 0.16, ease: chromeEase },
        height: { duration: 0.16, ease: chromeEase },
      }}
      style={{
        position: 'absolute',
        zIndex: 2,
        objectFit: 'fill',
        pointerEvents: 'none',
        filter: `saturate(${MEDIA_SATURATE}) brightness(1.02)`,
      }}
    />
  )
}

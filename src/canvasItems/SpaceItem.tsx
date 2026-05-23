import { useCallback, useRef, useState, type RefObject } from 'react'
import { motion } from 'framer-motion'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { playSound } from '../sound/playSound'
import { isItemFrozen } from '../canvasLock/layer'
import { useCanvasLockStore } from '../canvasLock/canvasLockStore'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import DragHandle from './DragHandle'
import { useCanvasItemDrag } from './useCanvasItemDrag'
import SpaceCardPreview from '../spaces/SpaceCardPreview'
import { card, font, glass, SPACE_GLASS_CLASS } from '../styles/tokens'
import { useCanvasNavigationStore } from '../canvas/canvasNavigationStore'
import type { SpaceCanvasItem } from './types'

const DRAG_THRESHOLD_PX = 10
const liftSpring = { type: 'spring' as const, stiffness: 380, damping: 28, mass: 0.7 }

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1)
}

export default function SpaceItem({
  item,
  transformRef,
  liftZIndex,
}: {
  item: SpaceCanvasItem
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  liftZIndex?: number
}) {
  const isLocked = useCanvasLockStore((s) => s.isLocked)
  const frozen = isItemFrozen(item, isLocked)
  const transitionPhase = useCanvasWorkspaceStore((s) => s.transition.phase)
  const spaceMeta = useCanvasWorkspaceStore((s) => s.spaces[item.id])
  const displayName = spaceMeta?.name ?? item.name
  const hasPreviewContent =
    !!spaceMeta &&
    (spaceMeta.items.length > 0 ||
      spaceMeta.strokes.length > 0 ||
      spaceMeta.annotationStrokes.length > 0)
  const cardRef = useRef<HTMLDivElement>(null)

  const { isDragging, onGrabPointerDown } = useCanvasItemDrag(item.id)

  const bodyPhaseRef = useRef<'idle' | 'pending' | 'navigating'>('idle')
  const bodyPointerRef = useRef({ startX: 0, startY: 0 })
  const isSelected = liftZIndex != null

  const enterSpace = useCallback(() => {
    const el = cardRef.current
    if (!el || transitionPhase !== 'idle') return
    const rect = el.getBoundingClientRect()
    const workspace = useCanvasWorkspaceStore.getState()
    playSound('spaceEnter')
    workspace.beginEnterSpace(item.id, rect)
    setTimeout(() => {
      workspace.completeEnterSpace(transformRef.current)
    }, 280)
  }, [item.id, transformRef, transitionPhase])

  const handleBodyPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === 'pen') return
      e.stopPropagation()
      bodyPhaseRef.current = 'pending'
      bodyPointerRef.current = { startX: e.clientX, startY: e.clientY }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [],
  )

  const handleBodyPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (bodyPhaseRef.current !== 'pending') return
      const { startX, startY } = bodyPointerRef.current
      if (dist(e.clientX, e.clientY, startX, startY) > DRAG_THRESHOLD_PX) {
        bodyPhaseRef.current = 'idle'
        try {
          ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
        } catch {
          // ignore
        }
      }
    },
    [],
  )

  const handleBodyPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (
        bodyPhaseRef.current === 'pending' &&
        !useCanvasNavigationStore.getState().shouldSuppressItemTap()
      ) {
        enterSpace()
      }
      bodyPhaseRef.current = 'idle'
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    },
    [enterSpace],
  )

  const [hovered, setHovered] = useState(false)
  const lifted = isDragging
  const canHover = !frozen && !isLocked

  return (
    <motion.div
      ref={cardRef}
      data-canvas-item="space"
      data-item-id={item.id}
      data-active={lifted || undefined}
      data-selected={isSelected || undefined}
      animate={{
        scale: lifted ? 1.03 : canHover && hovered ? 1.01 : 1,
        boxShadow: lifted ? card.shadow : glass.shadow,
      }}
      transition={liftSpring}
      onMouseEnter={() => canHover && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        left: item.x,
        top: item.y,
        width: item.width,
        height: item.height,
        zIndex: liftZIndex ?? item.zIndex,
        transformOrigin: 'top left',
        pointerEvents: 'none',
      }}
    >
      {!frozen && (
        <DragHandle onPointerDown={onGrabPointerDown} />
      )}

      {/* Stacked card shadow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 6,
          top: 6,
          right: -6,
          bottom: -6,
          borderRadius: 6,
          background: 'var(--glass-border)',
          boxShadow: glass.shadow,
          pointerEvents: 'none',
          opacity: 0.7,
        }}
      />

      <div
        role="button"
        tabIndex={0}
        aria-label={`Open space: ${displayName}`}
        onPointerDown={handleBodyPointerDown}
        onPointerMove={handleBodyPointerMove}
        onPointerUp={handleBodyPointerUp}
        onPointerCancel={handleBodyPointerUp}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            enterSpace()
          }
        }}
        className={`theme-surface ${SPACE_GLASS_CLASS}${isSelected ? ' canvas-item-selected-focus' : ''}`}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: 6,
          background: glass.bg,
          border: glass.border,
          boxShadow: glass.shadow,
          overflow: 'hidden',
          pointerEvents: 'auto',
          cursor: canHover ? 'pointer' : 'default',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '10px 12px 6px 36px',
            fontSize: 16,
            fontWeight: 500,
            color: font.colorMuted,
            lineHeight: 1.2,
            flexShrink: 0,
            userSelect: 'none',
          }}
        >
          {displayName}
        </div>
        <div
          style={{
            flex: 1,
            margin: '0 10px 10px',
            borderRadius: 4,
            overflow: 'hidden',
            position: 'relative',
            minHeight: 0,
            background: card.bg,
            boxShadow: 'inset 0 0 0 1px var(--glass-border)',
          }}
        >
          {hasPreviewContent ? (
            <SpaceCardPreview spaceId={item.id} />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 4,
                border: `1.5px dashed ${font.colorFaint}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: font.colorFaint,
                fontSize: 13,
                fontWeight: 500,
                background: card.bg,
              }}
            >
              Empty space
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

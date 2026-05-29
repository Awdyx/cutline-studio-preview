import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { CANVAS_ORIGINAL_HEIGHT, CANVAS_ORIGINAL_WIDTH } from '../drawing/canvasDimensions'
import { isItemFrozen } from '../canvasLock/layer'
import { useCanvasLockStore } from '../canvasLock/canvasLockStore'
import {
  useCanvasItemsStore,
  useItemIsSoleSelected,
  useItemSelected,
  useItemZOrderPulse,
} from './canvasItemsStore'
import { useCanvasEditingAllowed } from '../canvasEdit/layer'
import { useSpaceDropStore } from '../spaces/spaceDropStore'
import { useStickyDropStore } from './stickyDropStore'
import { useStickyBringOutStore } from './stickyBringOutStore'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import { useCanvasEditStore } from '../canvasEdit/canvasEditStore'
import DragHandle from './DragHandle'
import ResizeHandle from './ResizeHandle'
import { displayZIndexForCanvasItem } from './canvasZOrder'
import {
  getGrabHandlePlacement,
  resolveCanvasHandleHitSize,
  SMALL_TEXT_HANDLE_H,
  SMALL_TEXT_HANDLE_W,
} from './grabZone'
import { useCanvasItemDrag } from './useCanvasItemDrag'
import { useCanvasItemDragStore } from './canvasItemDragStore'
import { useCanvasItemResize } from './useCanvasItemResize'
import { useCanvasItemAreaPointer } from '../canvas/useCanvasItemAreaPointer'
import { useLassoStore } from '../drawing/useLassoStore'
import type { CanvasItem } from './types'
import {
  STUDY_HUB_ASPECT,
  isImageInSticky,
} from './types'
import { stickyEmbeddedImageCssZ } from './stickyImageLayers'
import {
  studyHubMaxCanvasHeight,
  studyHubMaxCanvasWidth,
  studyHubMinCanvasHeight,
  studyHubMinCanvasWidth,
} from './studyHubBounds'
import {
  canvasItemDeleteExit,
  canvasItemDeleteExitTransition,
  canvasItemLiftSpring,
  canvasItemSpaceTransferExit,
  canvasItemSpaceTransferExitTransition,
  stickyBringOutCanvasEnterTransition,
  stickyBringOutEmbeddedTransition,
} from './canvasItemMotion'
import { card } from '../styles/tokens'
import { focusStudyHubOnCanvas } from './studyHubMenuFocus'
import { studyHubBorderRadiusCss } from './studyHubSpawnScale'

const liftSpring = canvasItemLiftSpring

export default function CanvasItemShell({
  item,
  transformRef,
  onItemResizeStateChange,
  children,
  forceLift = false,
  embeddedInSticky = false,
  handlesPortal = null,
}: {
  item: CanvasItem
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  onItemResizeStateChange?: (resizing: boolean) => void
  children: React.ReactNode
  /** Lift above the selection dim without selecting (e.g. sticky/image drop target). */
  forceLift?: boolean
  /** Image (or other item) rendered inside a sticky — moves with sticky transforms. */
  embeddedInSticky?: boolean
  /** When set, drag/resize handles portal here so they aren't clipped by the sticky face. */
  handlesPortal?: HTMLElement | null
}) {
  const { isDragging, onGrabPointerDown } = useCanvasItemDrag(item.id)
  const activeDragItemId = useCanvasItemDragStore((s) => s.activeItemId)
  const parentStickyDragging =
    embeddedInSticky &&
    item.type === 'image' &&
    isImageInSticky(item) &&
    activeDragItemId === item.stickyId
  const boundsSnapPulse = useCanvasItemDragStore((s) =>
    s.boundsSnapBackItemId === item.id ? s.boundsSnapBackNonce : 0,
  )
  const isAbsorbing =
    useSpaceDropStore((s) => s.absorbingItemId === item.id) ||
    useStickyDropStore((s) => s.absorbingItemId === item.id)
  const bringingOutThisItem = useStickyBringOutStore(
    (s) => s.bringingOutItemId === item.id,
  )
  const isBringingOutEmbedded = embeddedInSticky && bringingOutThisItem
  const broughtOutNonce = useStickyBringOutStore((s) =>
    s.recentlyBroughtOutItemId === item.id ? s.recentlyBroughtOutNonce : 0,
  )
  const isEnteringFromSticky =
    !embeddedInSticky && item.type === 'image' && broughtOutNonce > 0

  const selectSelf = useCallback(
    () => useCanvasItemsStore.getState().selectItem(item.id),
    [item.id],
  )

  const resizeOptions = item.type === 'study_hub'
    ? {
        minWidth: studyHubMinCanvasWidth(),
        minHeight: studyHubMinCanvasHeight(),
        maxWidth: studyHubMaxCanvasWidth(),
        maxHeight: studyHubMaxCanvasHeight(),
        mode: 'center-uniform' as const,
        aspectRatio: STUDY_HUB_ASPECT,
      }
    : (item.type === 'image' || item.type === 'video') &&
        item.importWidth != null && item.importHeight != null
      ? { importWidth: item.importWidth, importHeight: item.importHeight }
      : undefined

  const { isResizing, snapBack, handlePointerDown: onResizeDown } = useCanvasItemResize(
    item.id,
    item.width,
    item.height,
    transformRef,
    onItemResizeStateChange,
    resizeOptions,
    selectSelf,
  )

  const isLocked = useCanvasLockStore((s) => s.isLocked)
  const isPhone = useIsPhoneLayout()
  const canvasEditEnabled = useCanvasEditStore((s) => s.enabled)
  const isStudyHub = item.type === 'study_hub'
  const editBlocked = isPhone && !canvasEditEnabled
  const moveBlocked = editBlocked
  const frozen = isItemFrozen(item, isLocked)
  const interactionFrozen = frozen || moveBlocked
  const isSelected = useItemSelected(item.id)
  const isSoleSelected = useItemIsSoleSelected(item.id)
  const selectedIds = useCanvasItemsStore((s) => s.selectedIds)
  const allItems = useCanvasItemsStore((s) => s.items)
  const zOrderPulse = useItemZOrderPulse(item.id)
  const editingAllowed = useCanvasEditingAllowed()
  const zMenuSuppressedItemId = useCanvasItemsStore((s) => s.zMenuSuppressedItemId)
  const menuFocusReturnCamera = useCanvasItemsStore((s) => s.menuFocusReturnCamera)
  const hideItemHandles = zMenuSuppressedItemId === item.id
  const hideDragHandle =
    hideItemHandles ||
    (isSoleSelected && editingAllowed && zMenuSuppressedItemId !== item.id)
  const [zPulseClass, setZPulseClass] = useState<string | null>(null)
  const lastZPulseNonce = useRef(0)

  useEffect(() => {
    if (!zOrderPulse || embeddedInSticky) return
    if (zOrderPulse.nonce === lastZPulseNonce.current) return
    lastZPulseNonce.current = zOrderPulse.nonce
    setZPulseClass(
      zOrderPulse.dir === 'front'
        ? 'canvas-item-z-pulse-front'
        : 'canvas-item-z-pulse-back',
    )
    const timer = window.setTimeout(() => setZPulseClass(null), 360)
    return () => window.clearTimeout(timer)
  }, [zOrderPulse, embeddedInSticky])
  const focusStudyHubMenu = useCallback(() => {
    focusStudyHubOnCanvas(transformRef.current, item.id)
  }, [item.id, transformRef])

  const areaPointer = useCanvasItemAreaPointer({
    itemId: item.id,
    isSelected,
    frozen,
    moveBlocked,
    onGrabPointerDown,
    onPrimaryActivate: isStudyHub ? focusStudyHubMenu : undefined,
  })
  const displayZIndex = useMemo(() => {
    const base = embeddedInSticky
      ? stickyEmbeddedImageCssZ(item.zIndex)
      : displayZIndexForCanvasItem(allItems, item, selectedIds, {
          forceLift,
          isActiveDrag: isDragging && isSelected,
        })
    if (isBringingOutEmbedded) return Math.max(base, 5)
    return base
  }, [
    allItems,
    item,
    selectedIds,
    isDragging,
    isSelected,
    forceLift,
    embeddedInSticky,
    isBringingOutEmbedded,
  ])
  const isFlatChrome =
    item.type === 'text' || item.type === 'image' || item.type === 'video'
  const skipLiftMotion = item.type === 'text'
  const lifted = (isDragging || isResizing) && !parentStickyDragging
  const absorbTransition = { duration: 0.34, ease: [0.4, 0, 0.2, 1] as const }
  // Stickies clip inside StickyNote so embedded-image overflow previews can extend out.
  const clipContent = item.type === 'study_hub'
  const embeddedStickyParentId =
    embeddedInSticky && item.type === 'image' && isImageInSticky(item)
      ? item.stickyId
      : null
  const stickyParentLassoSelected = useLassoStore((s) =>
    embeddedStickyParentId != null &&
    s.selectedItemIds.includes(embeddedStickyParentId),
  )
  const skipEmbeddedLassoOffset =
    embeddedInSticky && stickyParentLassoSelected
  // Embedded images are only directly interactive once their sticky is selected
  // (or the image itself is). Otherwise clicks fall through and select the sticky.
  const embeddedParentSelected =
    embeddedStickyParentId != null && selectedIds.includes(embeddedStickyParentId)
  const embeddedInteractive =
    !embeddedInSticky || isSelected || embeddedParentSelected
  // Live drag preview when this item is part of a lasso drag
  const lassoDx = useLassoStore((s) =>
    s.dragOffset && s.selectedItemIds.includes(item.id) && !skipEmbeddedLassoOffset
      ? s.dragOffset.canvasDx
      : 0,
  )
  const lassoDy = useLassoStore((s) =>
    s.dragOffset && s.selectedItemIds.includes(item.id) && !skipEmbeddedLassoOffset
      ? s.dragOffset.canvasDy
      : 0,
  )
  const isLassoDragPreview = useLassoStore(
    (s) => s.dragOffset != null && s.selectedItemIds.includes(item.id),
  )
  // Hide drag/resize handles while this item is part of a lasso group selection
  const isLassoSelected = useLassoStore((s) => s.selectedItemIds.includes(item.id))

  const handleHitSize = resolveCanvasHandleHitSize({
    small:
      item.type === 'text' &&
      item.width < SMALL_TEXT_HANDLE_W &&
      item.height < SMALL_TEXT_HANDLE_H,
  })

  const grabHandlePlacement = useMemo(
    () =>
      getGrabHandlePlacement(
        item.x,
        item.y,
        item.width,
        item.height,
        CANVAS_ORIGINAL_WIDTH,
        CANVAS_ORIGINAL_HEIGHT,
        handleHitSize,
      ),
    [item.x, item.y, item.width, item.height, handleHitSize],
  )
  const studyHubLayout =
    isStudyHub && !isResizing && !isDragging && !snapBack && !isLassoDragPreview
      ? ('size' as const)
      : false
  const textLayout =
    item.type === 'text' && !isDragging && !isResizing && !isLassoDragPreview
      ? (true as const)
      : false
  const shrinkSpring = { type: 'spring' as const, stiffness: 320, damping: 28, mass: 0.6 }
  const shellTransition =
    (isResizing || snapBack) && isStudyHub
      ? { duration: 0 }
      : item.type === 'text'
        ? { ...liftSpring, layout: shrinkSpring }
        : liftSpring
  const isSticky = item.type === 'sticky'
  const liftShadow = isSticky
    ? 'var(--sticky-lift-shadow)'
    : '0 12px 40px rgba(20, 30, 50, 0.22)'
  const restShadow = isSticky
    ? 'var(--sticky-rest-shadow)'
    : '0 2px 10px rgba(20, 30, 50, 0.12)'
  const studyHubPortalActive =
    isStudyHub &&
    menuFocusReturnCamera != null &&
    zMenuSuppressedItemId === item.id
  const peelLiftShadow = '0 10px 32px rgba(20, 30, 50, 0.2)'
  const shellBoxShadow = isBringingOutEmbedded
    ? peelLiftShadow
    : skipLiftMotion || embeddedInSticky
      ? 'none'
      : isStudyHub
        ? studyHubPortalActive
          ? 'none'
          : lifted && !isResizing
            ? liftShadow
            : card.shadow
        : lifted && !isResizing
          ? liftShadow
          : isEnteringFromSticky
            ? peelLiftShadow
            : restShadow

  const portHandlesOutsideClip = embeddedInSticky && handlesPortal != null
  const showItemHandles =
    !interactionFrozen &&
    !hideItemHandles &&
    embeddedInteractive &&
    !isLassoSelected &&
    !isBringingOutEmbedded

  const itemHandleLayer = showItemHandles ? (
    <motion.div
      key="item-handles"
      data-lock-flatten-skip
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {!hideDragHandle && (
        <DragHandle
          placement={grabHandlePlacement}
          onPointerDown={(e) => onGrabPointerDown(e, { onReleaseWithoutDrag: selectSelf })}
          hitSize={handleHitSize}
        />
      )}
      <ResizeHandle onPointerDown={onResizeDown} hitSize={handleHitSize} />
    </motion.div>
  ) : null

  return (
    <motion.div
      data-canvas-item={item.type}
      data-item-id={item.id}
      className={boundsSnapPulse ? 'canvas-item-bounds-snap-pulse' : undefined}
      data-active={lifted || undefined}
      data-selected={isSelected || undefined}
      data-resizing={isResizing && isStudyHub ? true : undefined}
      data-dragging={isDragging && isStudyHub ? true : undefined}
      layout={textLayout || studyHubLayout}
      initial={
        isEnteringFromSticky
          ? { scale: 0.968, opacity: 0.48 }
          : false
      }
      exit={
        isAbsorbing
          ? {
              ...canvasItemSpaceTransferExit,
              transition: canvasItemSpaceTransferExitTransition,
            }
          : {
              ...canvasItemDeleteExit,
              transition: canvasItemDeleteExitTransition,
            }
      }
      animate={{
        scale: isBringingOutEmbedded
          ? 1.028
          : isAbsorbing
            ? 0.86
            : skipLiftMotion
              ? 1
              : lifted && !isResizing
                ? 1.03
                : 1,
        opacity: isBringingOutEmbedded ? 0 : isAbsorbing ? 0.35 : 1,
        boxShadow: shellBoxShadow,
      }}
      transition={
        isBringingOutEmbedded
          ? stickyBringOutEmbeddedTransition
          : isEnteringFromSticky
            ? stickyBringOutCanvasEnterTransition
            : isAbsorbing
              ? absorbTransition
              : shellTransition
      }
      style={{
        position: 'absolute',
        left: item.x,
        top: item.y,
        width: item.width,
        height: item.height,
        zIndex: displayZIndex,
        transformOrigin:
          isBringingOutEmbedded || isEnteringFromSticky ? 'center center' : 'top left',
        overflow: 'visible',
        pointerEvents: 'none',
        x: lassoDx,
        y: lassoDy,
        borderRadius: isStudyHub
          ? studyHubBorderRadiusCss(item.width)
          : item.type === 'sticky'
            ? 4
            : isFlatChrome
              ? 0
              : 8,
      }}
    >
      {!portHandlesOutsideClip && (
        <AnimatePresence>{itemHandleLayer}</AnimatePresence>
      )}
      {portHandlesOutsideClip &&
        handlesPortal &&
        showItemHandles &&
        createPortal(
          <div
            data-canvas-item={item.type}
            data-item-id={item.id}
            data-selected={isSelected || undefined}
            style={{
              position: 'absolute',
              left: item.x,
              top: item.y,
              width: item.width,
              height: item.height,
              pointerEvents: 'none',
            }}
          >
            <AnimatePresence>{itemHandleLayer}</AnimatePresence>
          </div>,
          handlesPortal,
        )}
      <div
        onPointerDown={(e) => {
          if (e.target instanceof HTMLElement && e.target.closest('button')) return
          areaPointer.onPointerDown(e)
        }}
        onPointerMove={areaPointer.onPointerMove}
        onPointerUp={areaPointer.onPointerUp}
        onPointerCancel={areaPointer.onPointerCancel}
        onContextMenu={areaPointer.onContextMenu}
        className={[
          isSelected || embeddedParentSelected ? 'canvas-item-selected-focus' : null,
          zPulseClass,
        ]
          .filter(Boolean)
          .join(' ') || undefined}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius:
            item.type === 'sticky'
              ? 4
              : item.type === 'study_hub'
                ? studyHubBorderRadiusCss(item.width)
                : isFlatChrome
                  ? 0
                  : 8,
          overflow: clipContent ? 'hidden' : 'visible',
          // Lasso drag is handled by LassoSelectionChrome — don't steal the pointer.
          // Embedded images stay click-through until their sticky is selected.
          pointerEvents: isLassoSelected || !embeddedInteractive ? 'none' : 'auto',
        }}
      >
        {children}
      </div>
    </motion.div>
  )
}

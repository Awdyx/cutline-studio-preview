import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { readActiveCanvasLogicalWidth, readActiveCanvasLogicalHeight } from '../spaces/activeCanvasLayout'
import { isItemFrozen } from '../canvasLock/layer'
import { useCanvasLockStore } from '../canvasLock/canvasLockStore'
import {
  useCanvasItemsStore,
  useItemIsSoleSelected,
  useItemSelected,
} from './canvasItemsStore'
import { useCanvasEditingAllowed } from '../canvasEdit/layer'
import { useStickyDropStore } from './stickyDropStore'
import { isSpaceDropInstantRemove } from './canvasItemDrag'
import { useStickyBringOutStore } from './stickyBringOutStore'
import { useIsPhoneLayout } from '../hooks/useLayoutProfile'
import { useCanvasEditStore } from '../canvasEdit/canvasEditStore'
import DragHandle from './DragHandle'
import ResizeHandle from './ResizeHandle'
import { displayZIndexForCanvasItem, Z_SELECTION_ABOVE_DIM, committedItemZRank } from './canvasZOrder'
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
  stickyBringOutCanvasEnterTransition,
  stickyBringOutEmbeddedTransition,
} from './canvasItemMotion'
import { card } from '../styles/tokens'
import { focusStudyHubOnCanvas } from './studyHubMenuFocus'
import { studyHubBorderRadiusCss } from './studyHubSpawnScale'
import {
  CanvasItemCustomizePortalStage,
  isCanvasItemUiCustomizableType,
  useCanvasItemCustomizePortal,
} from '../canvasItemCustomize'
import { useCanvasCustomizeExitLand } from '../canvasItemCustomize/canvasCustomizeExitLand'
import { useCanvasCustomizeEnterCanvasHide } from '../canvasItemCustomize/useCanvasCustomizeEnterCanvasHide'
import CanvasItemUiPinAnchor from '../uiCustomization/CanvasItemUiPinAnchor'
import {
  useCanvasCustomizeActive,
  useCanvasCustomizeExiting,
  useCanvasCustomizeHidesItemChrome,
  useCanvasCustomizeStore,
  useCanvasCustomizeItemHandoff,
} from '../canvasItemCustomize/canvasCustomizeStore'
import { useUiCustomizationStore } from '../uiCustomization/uiCustomizationStore'
import { canvasItemUiAnchorId } from '../uiCustomization/types'

const liftSpring = canvasItemLiftSpring

export default function CanvasItemShell({
  item,
  transformRef,
  onItemResizeStateChange,
  children,
  forceLift = false,
  embeddedInSticky = false,
  handlesPortal = null,
  persistWhileCustomizeHide = null,
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
  /** Stays mounted while canvas copy hides for customize lift (e.g. sticky overflow ghost). */
  persistWhileCustomizeHide?: React.ReactNode
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
  const isAbsorbing = useStickyDropStore((s) => s.absorbingItemId === item.id)
  const instantSpaceDropExit = isSpaceDropInstantRemove(item.id)
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
        mode: 'corner' as const,
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
  const studyHubAspectSnapAnimating = useCanvasItemsStore(
    (s) => isStudyHub && s.boundsSnapAnimatingId === item.id,
  )
  const editBlocked = isPhone && !canvasEditEnabled
  const moveBlocked = editBlocked
  const frozen = isItemFrozen(item, isLocked)
  const interactionFrozen = frozen || moveBlocked
  const isSelected = useItemSelected(item.id)
  const isSoleSelected = useItemIsSoleSelected(item.id)
  const selectedIds = useCanvasItemsStore((s) => s.selectedIds)
  const allItems = useCanvasItemsStore((s) => s.items)
  const editingAllowed = useCanvasEditingAllowed()
  const zMenuSuppressedItemId = useCanvasItemsStore((s) => s.zMenuSuppressedItemId)
  const menuFocusRevealed = useCanvasItemsStore((s) => s.menuFocusRevealed)
  const menuFocusReturnCamera = useCanvasItemsStore((s) => s.menuFocusReturnCamera)
  const hideItemHandles = zMenuSuppressedItemId === item.id
  const hideDragHandle =
    hideItemHandles ||
    (isSoleSelected && editingAllowed && zMenuSuppressedItemId !== item.id)
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
  const canvasCustomizeActive = useCanvasCustomizeActive()
  const customizeExiting = useCanvasCustomizeExiting(item.id)
  const customizeHidesHandles = useCanvasCustomizeHidesItemChrome(
    item.id,
    embeddedInSticky && item.type === 'image' && isImageInSticky(item)
      ? item.stickyId
      : null,
  )
  const focusedCustomizeAnchor = useUiCustomizationStore((s) => s.focusedAnchorId)
  const isCustomizingItem =
    canvasCustomizeActive &&
    !customizeExiting &&
    focusedCustomizeAnchor === canvasItemUiAnchorId(item.id)
  const displayZIndex = useMemo(() => {
    if (isCustomizingItem) {
      return Z_SELECTION_ABOVE_DIM + committedItemZRank(allItems, item.id) * 2
    }
    if (customizeExiting) {
      return embeddedInSticky
        ? stickyEmbeddedImageCssZ(item.zIndex)
        : item.zIndex
    }
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
    isCustomizingItem,
    customizeExiting,
  ])
  const isFlatChrome =
    item.type === 'text' || item.type === 'image' || item.type === 'video'
  const embeddedStickyParentId =
    embeddedInSticky && item.type === 'image' && isImageInSticky(item)
      ? item.stickyId
      : null
  const stickyParentCustomizing = useCanvasCustomizeStore(
    (s) =>
      embeddedStickyParentId != null &&
      (s.handoffItemId === embeddedStickyParentId ||
        ((s.active || s.exiting) && s.itemId === embeddedStickyParentId)),
  )
  const skipLiftMotion = item.type === 'text' || embeddedInSticky
  const suppressEmbeddedLift = embeddedInSticky && stickyParentCustomizing
  const lifted =
    !suppressEmbeddedLift && (isDragging || isResizing) && !parentStickyDragging
  const absorbTransition = { duration: 0.34, ease: [0.4, 0, 0.2, 1] as const }
  // Stickies clip inside StickyNote so embedded-image overflow previews can extend out.
  const clipContent = item.type === 'study_hub'
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
        readActiveCanvasLogicalWidth(),
        readActiveCanvasLogicalHeight(),
        handleHitSize,
      ),
    [item.x, item.y, item.width, item.height, handleHitSize],
  )
  const studyHubLayout =
    isStudyHub &&
    isResizing &&
    !isDragging &&
    !snapBack &&
    !isLassoDragPreview
      ? ('size' as const)
      : false
  const textLayout =
    item.type === 'text' &&
    (isResizing || isDragging) &&
    !isLassoDragPreview
      ? (true as const)
      : false
  const shrinkSpring = { type: 'spring' as const, stiffness: 320, damping: 28, mass: 0.6 }
  const shellTransition =
    suppressEmbeddedLift ||
    ((isResizing || snapBack || studyHubAspectSnapAnimating) && isStudyHub)
      ? { duration: 0 }
      : item.type === 'text'
        ? { ...liftSpring, layout: shrinkSpring }
        : liftSpring
  const isSticky = item.type === 'sticky'
  const isFlatMedia = item.type === 'image' || item.type === 'video'
  const liftShadow = isSticky
    ? 'var(--sticky-lift-shadow)'
    : '0 12px 40px rgba(20, 30, 50, 0.22)'
  const restShadow = isSticky
    ? 'var(--sticky-rest-shadow)'
    : isFlatMedia
      ? 'none'
      : '0 2px 10px rgba(20, 30, 50, 0.12)'
  const studyHubPortalActive =
    isStudyHub &&
    menuFocusRevealed &&
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

  const uiCustomizable =
    !embeddedInSticky && isCanvasItemUiCustomizableType(item.type)
  const customizePortal = useCanvasItemCustomizePortal(item.id, uiCustomizable)
  const showCustomizePortal =
    uiCustomizable && customizePortal.portalActive && customizePortal.lift != null

  const portHandlesOutsideClip = embeddedInSticky && handlesPortal != null
  const itemHandleBase =
    !interactionFrozen &&
    !hideItemHandles &&
    embeddedInteractive &&
    !isLassoSelected &&
    !isBringingOutEmbedded
  const customizeChromeHidden =
    customizeHidesHandles || (uiCustomizable && showCustomizePortal)
  const mountItemHandles = itemHandleBase

  const itemHandleLayer = mountItemHandles ? (
    <motion.div
      key="item-handles"
      data-lock-flatten-skip
      initial={false}
      animate={{ opacity: customizeChromeHidden ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: customizeChromeHidden ? (embeddedInSticky ? 0.3 : 0) : 0.4,
        ease: 'easeOut',
      }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6 }}
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

  const shellRef = useRef<HTMLDivElement>(null)
  const exitLandRef = useRef<HTMLDivElement>(null)
  const customizeItemHandoff = useCanvasCustomizeItemHandoff(item.id)
  const customizeEnterPhase = useCanvasCustomizeStore((s) =>
    s.itemId === item.id ? s.enterPhase : 'idle',
  )
  const finishCustomizeDismiss = useCanvasCustomizeStore((s) => s.finishDismiss)
  const itemSurfaceRadius =
    item.type === 'sticky'
      ? 4
      : item.type === 'study_hub'
        ? studyHubBorderRadiusCss(item.width)
        : isFlatChrome
          ? 0
          : 8

  /** Fresh element tree per call — never reuse one React element in portal + canvas. */
  const renderItemContent = (instance: 'canvas' | 'portal', pinFocused: boolean) => {
    const surface = (
      <div
        data-customize-content-instance={instance}
        onPointerDown={(e) => {
          if (e.target instanceof HTMLElement && e.target.closest('button')) return
          areaPointer.onPointerDown(e)
        }}
        onPointerMove={areaPointer.onPointerMove}
        onPointerUp={areaPointer.onPointerUp}
        onPointerCancel={areaPointer.onPointerCancel}
        onContextMenu={areaPointer.onContextMenu}
        className={
          isSelected || embeddedParentSelected ? 'canvas-item-selected-focus' : undefined
        }
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: itemSurfaceRadius,
          overflow: clipContent ? 'hidden' : 'visible',
          pointerEvents: isCustomizingItem || isLassoSelected || !embeddedInteractive ? 'none' : 'auto',
        }}
      >
        {children}
      </div>
    )
    if (!uiCustomizable) return surface
    return (
      <CanvasItemUiPinAnchor itemId={item.id} focused={pinFocused}>
        {surface}
      </CanvasItemUiPinAnchor>
    )
  }

  const showCustomizePortalStage = showCustomizePortal && !customizeExiting

  const hideCanvasCustomizeContent = useCanvasCustomizeEnterCanvasHide(
    item.id,
    showCustomizePortal,
    customizeExiting,
  )

  /** Never mount portal children during staging — same `{children}` cannot live in two trees. */
  const mountPortalCustomizeContent =
    showCustomizePortalStage && customizeEnterPhase !== 'staging'

  const customizeMotionLocked =
    showCustomizePortalStage ||
    customizeExiting ||
    suppressEmbeddedLift ||
    (uiCustomizable && customizeItemHandoff)

  const reduceMotion = useReducedMotion()
  useCanvasCustomizeExitLand(exitLandRef, {
    enabled: Boolean(uiCustomizable && customizeExiting && customizePortal.lift),
    lift: customizePortal.lift,
    reduceMotion,
    onComplete: finishCustomizeDismiss,
  })

  const shellOnCanvas = (
    <motion.div
      ref={shellRef}
      data-canvas-item={item.type}
      data-item-id={item.id}
      className={boundsSnapPulse ? 'canvas-item-bounds-snap-pulse' : undefined}
      data-active={lifted || undefined}
      data-selected={isSelected || undefined}
      data-resizing={isResizing && isStudyHub ? true : undefined}
      data-dragging={isDragging && isStudyHub ? true : undefined}
      layout={
        customizeMotionLocked
          ? false
          : textLayout || studyHubLayout
      }
      initial={isEnteringFromSticky ? { scale: 0.968, opacity: 0.48 } : false}
      exit={
        instantSpaceDropExit
          ? { opacity: 0, transition: { duration: 0 } }
          : {
              ...canvasItemDeleteExit,
              transition: canvasItemDeleteExitTransition,
            }
      }
      animate={
        uiCustomizable
          ? {
              x: lassoDx,
              y: lassoDy,
              scale: isBringingOutEmbedded
                ? 1.028
                : isAbsorbing
                  ? 0.86
                  : skipLiftMotion
                    ? 1
                    : lifted && !isResizing
                      ? 1.03
                      : 1,
              opacity: isBringingOutEmbedded
                ? 0
                : isAbsorbing
                  ? 0.35
                  : 1,
              boxShadow: customizeChromeHidden ? 'none' : shellBoxShadow,
            }
          : {
              scale: isBringingOutEmbedded
                ? 1.028
                : isAbsorbing
                  ? 0.86
                  : skipLiftMotion
                    ? 1
                    : lifted && !isResizing
                      ? 1.03
                      : 1,
              opacity: isBringingOutEmbedded
                ? 0
                : isAbsorbing
                  ? 0.35
                  : 1,
              boxShadow: customizeChromeHidden ? 'none' : shellBoxShadow,
            }
      }
      transition={
        customizeMotionLocked
          ? { duration: 0 }
          : uiCustomizable
            ? {
                ...shellTransition,
                boxShadow: { duration: 0.4, ease: 'easeOut' },
              }
            : isBringingOutEmbedded
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
        transformOrigin: 'top left',
        overflow: 'visible',
        pointerEvents: showCustomizePortal ? 'none' : 'none',
        x: uiCustomizable ? undefined : lassoDx,
        y: uiCustomizable ? undefined : lassoDy,
        borderRadius: itemSurfaceRadius,
      }}
    >
      {!hideCanvasCustomizeContent ? persistWhileCustomizeHide : null}
      <div
        ref={exitLandRef}
        style={{
          width: '100%',
          height: '100%',
          transformOrigin: 'top left',
          visibility: hideCanvasCustomizeContent ? 'hidden' : 'visible',
        }}
        aria-hidden={hideCanvasCustomizeContent || undefined}
      >
        {!hideCanvasCustomizeContent ? renderItemContent('canvas', false) : null}
      </div>
      {!portHandlesOutsideClip && (
        <AnimatePresence>{itemHandleLayer}</AnimatePresence>
      )}
    </motion.div>
  )

  return (
    <>
      {shellOnCanvas}
      {showCustomizePortalStage ? (
        <CanvasItemCustomizePortalStage
          lift={customizePortal.lift!}
          itemId={item.id}
          layoutWidth={item.width}
          layoutHeight={item.height}
          clipOverflow={customizePortal.clipOverflow}
          enterPhase={customizeEnterPhase}
          exiting={false}
        >
          {hideCanvasCustomizeContent ? persistWhileCustomizeHide : null}
          {mountPortalCustomizeContent
            ? renderItemContent('portal', true)
            : null}
        </CanvasItemCustomizePortalStage>
      ) : null}
      {portHandlesOutsideClip &&
        handlesPortal &&
        mountItemHandles &&
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
              zIndex: 6,
            }}
          >
            <AnimatePresence>{itemHandleLayer}</AnimatePresence>
          </div>,
          handlesPortal,
        )}
    </>
  )
}

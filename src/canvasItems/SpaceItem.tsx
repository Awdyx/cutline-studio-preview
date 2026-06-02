import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { CANVAS_ORIGINAL_HEIGHT, CANVAS_ORIGINAL_WIDTH } from '../drawing/canvasDimensions'
import { SPACE_NAME_DEFAULT_FONT_SIZE } from './textEditorFontSize'
import { playSound } from '../sound/playSound'
import { isItemFrozen } from '../canvasLock/layer'
import { useCanvasLockStore } from '../canvasLock/canvasLockStore'
import { useCanvasWorkspaceStore } from '../spaces/canvasWorkspaceStore'
import {
  DEFAULT_SPACE_NAME,
  DEFAULT_SPACE_NAME_PLACEHOLDER,
  SPACE_NAME_MAX_LENGTH,
  clampSpaceName,
  isDefaultSpaceName,
} from '../spaces/types'
import { useCanvasNavigationStore } from '../canvas/canvasNavigationStore'
import { useCanvasItemAreaPointer } from '../canvas/useCanvasItemAreaPointer'
import {
  dismissSelectionForOutsideItemTap,
  shouldSkipItemSelectForOutsideDismiss,
} from '../canvas/canvasSelectionDismiss'
import { useCanvasEditingAllowed } from '../canvasEdit/layer'
import DragHandle from './DragHandle'
import ResizeHandle from './ResizeHandle'
import { displayZIndexForCanvasItem, Z_SELECTION_ABOVE_DIM, committedItemZRank } from './canvasZOrder'
import {
  getGrabHandlePlacement,
  resolveCanvasHandleHitSize,
  SPACE_RESIZE_CORNER_OUTSET,
} from './grabZone'
import { useCanvasItemDrag } from './useCanvasItemDrag'
import { useCanvasItemDragStore } from './canvasItemDragStore'
import { useCanvasItemResize } from './useCanvasItemResize'
import {
  useCanvasItemsStore,
  useItemIsSoleSelected,
  useItemSelected,
} from './canvasItemsStore'
import SpaceCardPreview from '../spaces/SpaceCardPreview'
import { useSpaceDropStore } from '../spaces/spaceDropStore'
import { card, font, glass, SPACE_GLASS_CLASS } from '../styles/tokens'
import { useThemeStore } from '../theme/themeStore'
import { useEffectiveMode } from '../theme/useEffectiveMode'
import { resolveSpaceTintGlassOverlay } from './spaceTint'
import type { SpaceCanvasItem } from './types'
import {
  canvasItemDeleteExit,
  canvasItemDeleteExitTransition,
} from './canvasItemMotion'
import {
  resolveItemTextAlignment,
  textAlignmentEditorStyle,
} from './textAlignment'
import {
  CanvasItemCustomizePortalStage,
  useCanvasCustomizeActive,
  useCanvasCustomizeExiting,
  useCanvasCustomizeHidesItemChrome,
  useCanvasCustomizeStore,
  useCanvasItemCustomizePortal,
} from '../canvasItemCustomize'
import { useCanvasCustomizeExitLand } from '../canvasItemCustomize/canvasCustomizeExitLand'
import { useCanvasCustomizeEnterCanvasHide } from '../canvasItemCustomize/useCanvasCustomizeEnterCanvasHide'
import CanvasItemUiPinAnchor from '../uiCustomization/CanvasItemUiPinAnchor'
import { useUiCustomizationStore } from '../uiCustomization/uiCustomizationStore'
import { canvasItemUiAnchorId } from '../uiCustomization/types'

const liftSpring = { type: 'spring' as const, stiffness: 380, damping: 28, mass: 0.7 }

export default function SpaceItem({
  item,
  transformRef,
  onItemResizeStateChange,
}: {
  item: SpaceCanvasItem
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  onItemResizeStateChange?: (resizing: boolean) => void
}) {
  const isLocked = useCanvasLockStore((s) => s.isLocked)
  const frozen = isItemFrozen(item, isLocked)
  const themeMode = useThemeStore((s) => s.mode)
  const effectiveMode = useEffectiveMode(themeMode)
  const tintOverlay = resolveSpaceTintGlassOverlay(item.tint, effectiveMode)
  const spaceMeta = useCanvasWorkspaceStore((s) => s.spaces[item.id])
  const displayName = spaceMeta?.name ?? item.name
  const isDefaultName = isDefaultSpaceName(displayName)
  const titleLabel = isDefaultName ? DEFAULT_SPACE_NAME_PLACEHOLDER : displayName
  const cardRef = useRef<HTMLDivElement>(null)
  const exitLandRef = useRef<HTMLDivElement>(null)
  const customizePortal = useCanvasItemCustomizePortal(item.id, true)
  const customizeExiting = useCanvasCustomizeExiting(item.id)
  const customizeEnterPhase = useCanvasCustomizeStore((s) =>
    s.itemId === item.id ? s.enterPhase : 'idle',
  )
  const finishCustomizeDismiss = useCanvasCustomizeStore((s) => s.finishDismiss)
  const previewRef = useRef<HTMLDivElement>(null)
  const previewTapMovedRef = useRef(false)

  const { isDragging, onGrabPointerDown } = useCanvasItemDrag(item.id)
  const boundsSnapPulse = useCanvasItemDragStore((s) =>
    s.boundsSnapBackItemId === item.id ? s.boundsSnapBackNonce : 0,
  )
  const selectSelf = useCallback(
    () => useCanvasItemsStore.getState().selectItem(item.id),
    [item.id],
  )
  const { isResizing, handlePointerDown: onResizeDown } = useCanvasItemResize(
    item.id,
    item.width,
    item.height,
    transformRef,
    onItemResizeStateChange,
    undefined,
    selectSelf,
  )

  const isSelected = useItemSelected(item.id)
  const isSoleSelected = useItemIsSoleSelected(item.id)
  const editingAllowed = useCanvasEditingAllowed()
  const zMenuSuppressedItemId = useCanvasItemsStore((s) => s.zMenuSuppressedItemId)
  const selectedIds = useCanvasItemsStore((s) => s.selectedIds)
  const allItems = useCanvasItemsStore((s) => s.items)
  const dropHoverSpaceId = useSpaceDropStore((s) => s.hover?.spaceId ?? null)
  const dropConfirmSpaceId = useSpaceDropStore((s) => s.confirmPulseSpaceId)
  const dropConfirmNonce = useSpaceDropStore((s) => s.confirmPulseNonce)
  const isDropHoverTarget = dropHoverSpaceId === item.id
  const dragActiveItemId = useCanvasItemDragStore((s) => s.activeItemId)
  /**
   * Only ease-blur the space when the dim overlay is actually visible (i.e. a
   * selection is active). Dragging via the handle starts a drag without
   * selecting the item, so the dim never appears and the space shouldn't
   * pretend to be dim'd.
   */
  const selectionActive = selectedIds.length > 0
  /** During a drag, lift other spaces above the dim so we can ease their blur via an own CSS filter (z-flip would be a hard cut). */
  const dragLift =
    selectionActive &&
    dragActiveItemId != null &&
    dragActiveItemId !== item.id &&
    !isSelected
  const ownBlurActive = dragLift && !isDropHoverTarget
  /**
   * Drag start force-lifts the space above the dim — without this gate, the
   * filter would animate from 0 → 7px and flash the card clear for a moment.
   * We snap the filter into place on drag start, then enable easing one frame
   * later so subsequent hover-target toggles transition smoothly.
   */
  const [easeBlur, setEaseBlur] = useState(false)
  useLayoutEffect(() => {
    if (!dragLift) {
      setEaseBlur(false)
      return
    }
    const id = requestAnimationFrame(() => setEaseBlur(true))
    return () => {
      cancelAnimationFrame(id)
      setEaseBlur(false)
    }
  }, [dragLift])
  const [dropConfirmClass, setDropConfirmClass] = useState<string | null>(null)
  const lastDropConfirmNonce = useRef(0)

  useEffect(() => {
    if (dropConfirmSpaceId !== item.id) return
    if (dropConfirmNonce === lastDropConfirmNonce.current) return
    lastDropConfirmNonce.current = dropConfirmNonce
    setDropConfirmClass('space-preview-drop-confirm')
    const timer = window.setTimeout(() => setDropConfirmClass(null), 360)
    return () => window.clearTimeout(timer)
  }, [dropConfirmNonce, dropConfirmSpaceId, item.id])

  const hideDragHandle =
    isSoleSelected && editingAllowed && zMenuSuppressedItemId !== item.id
  const canvasCustomizeActive = useCanvasCustomizeActive()
  const customizeHidesHandles = useCanvasCustomizeHidesItemChrome(item.id)
  const focusedCustomizeAnchor = useUiCustomizationStore((s) => s.focusedAnchorId)
  const isCustomizingItem =
    canvasCustomizeActive &&
    !customizeExiting &&
    focusedCustomizeAnchor === canvasItemUiAnchorId(item.id)
  const displayZIndex = useMemo(
    () => {
      if (isCustomizingItem) {
        return Z_SELECTION_ABOVE_DIM + committedItemZRank(allItems, item.id) * 2
      }
      if (customizeExiting) {
        return item.zIndex
      }
      return displayZIndexForCanvasItem(allItems, item, selectedIds, {
        forceLift: isDropHoverTarget || dragLift,
        isActiveDrag: isDragging && isSelected,
      })
    },
    [allItems, item, selectedIds, isDropHoverTarget, dragLift, isDragging, isSelected, isCustomizingItem, customizeExiting],
  )

  const enterSpace = useCallback(() => {
    if (useCanvasWorkspaceStore.getState().canvasSwapBusy) return
    playSound('spaceEnter')
    useCanvasWorkspaceStore
      .getState()
      .enterSpace(item.id, transformRef.current)
  }, [item.id, transformRef])

  const tryOpenPreview = useCallback(() => {
    if (useCanvasNavigationStore.getState().shouldSuppressItemTap()) return
    if (shouldSkipItemSelectForOutsideDismiss(item.id)) {
      dismissSelectionForOutsideItemTap(item.id)
      return
    }
    enterSpace()
  }, [enterSpace, item.id])

  const updateSpaceName = useCanvasWorkspaceStore((s) => s.updateSpaceName)
  const [titleEditing, setTitleEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)
  const titleEditAllowed = editingAllowed && !frozen && isSelected

  useEffect(() => {
    if (titleEditing) titleInputRef.current?.focus()
  }, [titleEditing])

  const beginTitleEdit = useCallback(() => {
    if (!titleEditAllowed) return
    setTitleDraft(isDefaultName ? '' : clampSpaceName(displayName))
    setTitleEditing(true)
  }, [titleEditAllowed, isDefaultName, displayName])

  /** Live-save: every keystroke pushes through to the store so the name reflects
   * across the workspace immediately — the user never has to press Enter or
   * blur the field for the rename to "take". Empty drafts persist as the
   * default placeholder name. */
  const handleTitleChange = useCallback(
    (raw: string) => {
      const clamped = clampSpaceName(raw)
      setTitleDraft(clamped)
      const next = clamped.trim() || DEFAULT_SPACE_NAME
      updateSpaceName(item.id, next)
    },
    [item.id, updateSpaceName],
  )

  const closeTitleEdit = useCallback(() => {
    setTitleEditing(false)
  }, [])

  /** Cancel any in-flight rename if the space becomes immutable (locked / etc). */
  useEffect(() => {
    if (!titleEditAllowed && titleEditing) setTitleEditing(false)
  }, [titleEditAllowed, titleEditing])

  const areaPointer = useCanvasItemAreaPointer({
    itemId: item.id,
    isSelected,
    frozen,
    moveBlocked: false,
    onGrabPointerDown,
  })

  const handlePreviewPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (e.pointerType === 'pen') return
      e.stopPropagation()
      previewTapMovedRef.current = false
      if (shouldSkipItemSelectForOutsideDismiss(item.id)) {
        if (e.pointerType === 'mouse') {
          dismissSelectionForOutsideItemTap(item.id)
        }
        return
      }
      if (e.pointerType === 'mouse' && e.button === 2) {
        areaPointer.onPointerDown(e as ReactPointerEvent<HTMLElement>)
        return
      }
    },
    [areaPointer, item.id],
  )

  const handlePreviewPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (e.buttons === 0) return
      previewTapMovedRef.current = true
    },
    [],
  )

  const handlePreviewPointerUp = useCallback((_e: ReactPointerEvent) => {}, [])

  const handlePreviewPointerCancel = useCallback(
    (_e: ReactPointerEvent) => {
      previewTapMovedRef.current = false
    },
    [],
  )

  const handlePreviewClick = useCallback(
    (e: React.MouseEvent) => {
      if (previewTapMovedRef.current) {
        previewTapMovedRef.current = false
        return
      }
      e.stopPropagation()
      tryOpenPreview()
    },
    [tryOpenPreview],
  )

  const [hovered, setHovered] = useState(false)
  const lifted = isDragging || isResizing
  const canHover = !frozen && !isLocked
  const handleHitSize = resolveCanvasHandleHitSize()
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
  const spaceCardInner = (
    <>
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

      <CanvasItemUiPinAnchor
        itemId={item.id}
        focused={customizePortal.portalActive}
      >
      <div
        onPointerDown={areaPointer.onPointerDown}
        onPointerMove={areaPointer.onPointerMove}
        onPointerUp={areaPointer.onPointerUp}
        onPointerCancel={areaPointer.onPointerCancel}
        onContextMenu={areaPointer.onContextMenu}
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
          pointerEvents: isCustomizingItem ? 'none' : 'auto',
          cursor: 'var(--cursor-default)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {tintOverlay && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 6,
              background: tintOverlay,
              pointerEvents: 'none',
            }}
          />
        )}
        <div
          style={{
            padding: '7px 8px 9px',
            fontSize: SPACE_NAME_DEFAULT_FONT_SIZE,
            fontWeight: 500,
            lineHeight: 1.35,
            flexShrink: 0,
            position: 'relative',
            overflow: 'visible',
            ...textAlignmentEditorStyle(resolveItemTextAlignment(item)),
          }}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {titleEditing ? (
              <motion.input
                key="title-input"
                ref={titleInputRef}
                value={titleDraft}
                maxLength={SPACE_NAME_MAX_LENGTH}
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={closeTitleEdit}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter' || e.key === 'Escape') {
                    e.preventDefault()
                    closeTitleEdit()
                  }
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                aria-label={`Rename pocket: ${displayName}`}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  padding: 0,
                  margin: 0,
                  font: 'inherit',
                  color: font.colorPrimary,
                  textAlign: 'inherit',
                  cursor: 'text',
                }}
              />
            ) : (
              /* Single keyed view-mode wrapper — the button↔span swap inside
                 it is a regular React conditional so it doesn't pulse during
                 selection state changes. Only the view→edit transition is
                 animated (placeholder fades out as the input fades in). */
              <motion.div
                key="title-view"
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                style={{ display: 'inline-block' }}
              >
                {titleEditAllowed ? (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      beginTitleEdit()
                    }}
                    aria-label={`Rename pocket: ${displayName}`}
                    style={{
                      display: 'inline-block',
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      margin: 0,
                      font: 'inherit',
                      color: isDefaultName ? font.colorFaint : font.colorMuted,
                      opacity: isDefaultName ? 0.55 : 1,
                      cursor: 'text',
                      textAlign: 'inherit',
                      userSelect: 'none',
                    }}
                  >
                    {titleLabel}
                  </button>
                ) : (
                  <span
                    style={{
                      display: 'inline-block',
                      color: isDefaultName ? font.colorFaint : font.colorMuted,
                      opacity: isDefaultName ? 0.55 : 1,
                      userSelect: 'none',
                    }}
                  >
                    {titleLabel}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div
          ref={previewRef}
          role="button"
          tabIndex={0}
          data-space-preview=""
          className={[
            isDropHoverTarget ? 'space-preview-drop-hover' : null,
            dropConfirmClass,
          ]
            .filter(Boolean)
            .join(' ') || undefined}
          aria-label={`Open pocket: ${displayName}`}
          onPointerDown={handlePreviewPointerDown}
          onPointerMove={handlePreviewPointerMove}
          onPointerUp={handlePreviewPointerUp}
          onPointerCancel={handlePreviewPointerCancel}
          onClick={handlePreviewClick}
          onContextMenu={areaPointer.onContextMenu}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              tryOpenPreview()
            }
          }}
          style={{
            flex: 1,
            margin: '0 10px 10px',
            borderRadius: 4,
            overflow: 'hidden',
            position: 'relative',
            minHeight: 0,
            background: card.bg,
            boxShadow: 'inset 0 0 0 1px var(--glass-border)',
            cursor: canHover ? 'pointer' : 'default',
          }}
        >
          <SpaceCardPreview
            spaceId={item.id}
            showDropGhost={isDropHoverTarget}
          />
        </div>
      </div>
      </CanvasItemUiPinAnchor>
      {!frozen && !customizeHidesHandles && (
        <div data-lock-flatten-skip style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6 }}>
          {!hideDragHandle && (
            <DragHandle
              placement={grabHandlePlacement}
              onPointerDown={(e) => onGrabPointerDown(e, { onReleaseWithoutDrag: selectSelf })}
              hitSize={handleHitSize}
            />
          )}
          <ResizeHandle
            onPointerDown={onResizeDown}
            cornerOutset={SPACE_RESIZE_CORNER_OUTSET}
            hitSize={handleHitSize}
          />
        </div>
      )}
    </>
  )

  const showCustomizePortal =
    customizePortal.portalActive && customizePortal.lift != null

  const showCustomizePortalStage = showCustomizePortal && !customizeExiting

  const hideCanvasCustomizeContent = useCanvasCustomizeEnterCanvasHide(
    item.id,
    showCustomizePortal,
    customizeExiting,
  )

  const customizeMotionLocked = showCustomizePortalStage || customizeExiting

  const reduceMotion = useReducedMotion()
  useCanvasCustomizeExitLand(exitLandRef, {
    enabled: Boolean(customizeExiting && customizePortal.lift),
    lift: customizePortal.lift,
    reduceMotion,
    onComplete: finishCustomizeDismiss,
  })

  return (
    <>
      <motion.div
        ref={cardRef}
        data-canvas-item="space"
        data-item-id={item.id}
        className={boundsSnapPulse ? 'canvas-item-bounds-snap-pulse' : undefined}
        data-active={lifted || undefined}
        data-selected={isSelected || undefined}
        exit={{
          ...canvasItemDeleteExit,
          transition: canvasItemDeleteExitTransition,
        }}
        animate={{
          x: 0,
          y: 0,
          scale: lifted ? 1.03 : canHover && hovered ? 1.01 : 1,
          opacity: 1,
          boxShadow: showCustomizePortal ? 'none' : lifted
            ? card.shadow
            : glass.shadow,
        }}
        transition={customizeMotionLocked ? { duration: 0 } : liftSpring}
        onMouseEnter={() => canHover && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'absolute',
          left: item.x,
          top: item.y,
          width: item.width,
          height: item.height,
          zIndex: displayZIndex,
          transformOrigin: 'top left',
          overflow: 'visible',
          pointerEvents: 'none',
          visibility: hideCanvasCustomizeContent ? 'hidden' : 'visible',
          filter: ownBlurActive
            ? 'blur(7px)'
            : dragLift
              ? 'blur(0px)'
              : 'none',
          transition: easeBlur ? 'filter 220ms ease-out' : 'none',
          willChange: dragLift ? 'filter' : undefined,
        }}
        aria-hidden={hideCanvasCustomizeContent || undefined}
      >
        <div
          ref={exitLandRef}
          style={{
            width: '100%',
            height: '100%',
            transformOrigin: 'top left',
          }}
        >
          {!hideCanvasCustomizeContent ? spaceCardInner : null}
        </div>
      </motion.div>
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
          {customizeEnterPhase !== 'staging' ? spaceCardInner : null}
        </CanvasItemCustomizePortalStage>
      ) : null}
    </>
  )
}

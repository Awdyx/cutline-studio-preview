import { useEffect, useRef, useState, type RefObject } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Copy, Trash2 } from 'lucide-react'
import { useLassoStore } from './useLassoStore'
import { useStrokesStore } from './strokesStore'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { strokesScreenBounds, itemsScreenBounds } from './lassoGeometry'
import { card, font } from '../styles/tokens'
import { pushUndoSnapshot } from '../canvasHistory/canvasHistory'
import { HIGHLIGHTER_PRESETS, PEN_PRESETS, resolvePenColor } from './colorUtils'
import { useThemeStore } from '../theme/themeStore'
import { useEffectiveMode } from '../theme/useEffectiveMode'

/** Convert a screen-space delta to canvas-space delta using the canvas element's DPI scale. */
function screenToCanvasDelta(sdx: number, sdy: number, canvasEl: HTMLElement) {
  const rect = canvasEl.getBoundingClientRect()
  const sx = canvasEl.offsetWidth / rect.width
  const sy = canvasEl.offsetHeight / rect.height
  return { dx: sdx * sx, dy: sdy * sy }
}


const SUBMENU_BELOW_GAP = 32 // extra breathing room below the selection box

/** Below top-bar panels (30) and nested submenus (40+); above canvas content. */
const Z_LASSO_OVERLAY = 18
const Z_LASSO_SUBMENU = 19

type Props = {
  canvasRef: RefObject<HTMLDivElement | null>
}

export default function LassoOverlay({ canvasRef }: Props) {
  const drawingPoints = useLassoStore((s) => s.drawingPoints)
  const isDrawing = useLassoStore((s) => s.isDrawing)
  const selectedStrokeIds = useLassoStore((s) => s.selectedStrokeIds)
  const selectedItemIds = useLassoStore((s) => s.selectedItemIds)
  const clearSelection = useLassoStore((s) => s.clearSelection)

  const strokes = useStrokesStore((s) => s.strokes)
  const deleteStrokes = useStrokesStore((s) => s.deleteStrokes)
  const recolorStrokes = useStrokesStore((s) => s.recolorStrokes)
  const duplicateStrokes = useStrokesStore((s) => s.duplicateStrokes)
  const moveStrokes = useStrokesStore((s) => s.moveStrokes)

  const allItems = useCanvasItemsStore((s) => s.items)
  const themeMode = useThemeStore((s) => s.mode)
  const effectiveMode = useEffectiveMode(themeMode)

  const penColorIndexRef = useRef(0)
  const highlighterColorIndexRef = useRef(0)
  const isDragging = useRef(false)
  const lastDragPos = useRef<{ x: number; y: number } | null>(null)
  const didDrag = useRef(false)
  // Accumulated canvas-space delta since drag start — flushed to store via RAF
  const pendingCanvasDelta = useRef({ dx: 0, dy: 0 })
  // Total canvas-space delta for final commit on drop
  const totalCanvasDelta = useRef({ dx: 0, dy: 0 })
  const rafHandle = useRef<number | null>(null)

  const hasSelection = selectedStrokeIds.length > 0 || selectedItemIds.length > 0
  const canvasEl = canvasRef.current

  const selectedStrokes = strokes.filter((s) => selectedStrokeIds.includes(s.id))
  const selectedItems = allItems.filter((item) => selectedItemIds.includes(item.id))

  const penStrokes = selectedStrokes.filter((s) => s.tool === 'pen')
  const highlighterStrokes = selectedStrokes.filter((s) => s.tool === 'highlighter')
  const penStrokeIds = penStrokes.map((s) => s.id)
  const highlighterStrokeIds = highlighterStrokes.map((s) => s.id)
  const hasMixedStrokeTools = penStrokes.length > 0 && highlighterStrokes.length > 0

  const bounds = (() => {
    if (!hasSelection || !canvasEl) return null
    const sb = selectedStrokes.length > 0 ? strokesScreenBounds(selectedStrokes, canvasEl) : null
    const ib = selectedItems.length > 0 ? itemsScreenBounds(selectedItems, canvasEl) : null
    if (sb && ib) {
      return {
        left: Math.min(sb.left, ib.left),
        top: Math.min(sb.top, ib.top),
        right: Math.max(sb.right, ib.right),
        bottom: Math.max(sb.bottom, ib.bottom),
      }
    }
    return sb ?? ib
  })()

  // Build SVG path from lasso drawing points
  const lassoPath = drawingPoints.length > 1
    ? drawingPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z'
    : null

  // Clear selection on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearSelection()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clearSelection])

  // Clear selection if selected strokes disappear (e.g. deleted elsewhere)
  useEffect(() => {
    if (!hasSelection) return
    const stillExist = selectedStrokeIds.every((id) => strokes.some((s) => s.id === id))
    if (!stillExist) clearSelection()
  }, [strokes, selectedStrokeIds, hasSelection, clearSelection])

  // Dismiss when clicking outside the selection chrome (canvas, panels, other tools, etc.)
  useEffect(() => {
    if (!hasSelection) return

    function handlePointerDown(e: PointerEvent) {
      const target = e.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-lasso-selection]')) return
      // Don't dismiss when clicking on a lasso-selected canvas item — let the
      // item handle its own pointer interaction after the lasso clears.
      const itemEl = target.closest('[data-item-id]')
      if (itemEl) {
        const itemId = itemEl.getAttribute('data-item-id')
        if (itemId && useLassoStore.getState().selectedItemIds.includes(itemId)) return
      }
      useLassoStore.getState().clearSelection()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [hasSelection])

  const handlePenColor = () => {
    penColorIndexRef.current = (penColorIndexRef.current + 1) % PEN_PRESETS.length
    recolorStrokes(
      hasMixedStrokeTools ? penStrokeIds : selectedStrokeIds,
      PEN_PRESETS[penColorIndexRef.current],
    )
  }

  const handleHighlighterColor = () => {
    highlighterColorIndexRef.current =
      (highlighterColorIndexRef.current + 1) % HIGHLIGHTER_PRESETS.length
    recolorStrokes(highlighterStrokeIds, HIGHLIGHTER_PRESETS[highlighterColorIndexRef.current])
  }

  const handleDuplicate = () => {
    if (selectedStrokeIds.length > 0) {
      const newIds = duplicateStrokes(selectedStrokeIds)
      useLassoStore.setState({ selectedStrokeIds: newIds })
    }
    if (selectedItemIds.length > 0) {
      useCanvasItemsStore.getState().duplicateSelected()
      // After duplicate, the new items are in useCanvasItemsStore.selectedIds;
      // clear the stale lasso item IDs so the chrome updates from the canvas store.
      useLassoStore.setState({ selectedItemIds: [] })
    }
  }

  const handleDelete = () => {
    // Items first: deleteSelected() pushes one snapshot that captures the full
    // state (strokes still present). Strokes second: skip their own snapshot so
    // the entire mixed deletion lands in a single undo step.
    if (selectedItemIds.length > 0) useCanvasItemsStore.getState().deleteSelected()
    if (selectedStrokeIds.length > 0) deleteStrokes(selectedStrokeIds, { skipSnapshot: selectedItemIds.length > 0 })
    // Clear WITHOUT saving to previous* — elements are deleted, not just
    // deselected, so undoClearSelection() must not intercept the next Cmd+Z.
    useLassoStore.setState({
      selectedStrokeIds: [],
      selectedItemIds: [],
      previousStrokeIds: [],
      previousItemIds: [],
      dragOffset: null,
    })
  }

  // --- Drag handling (RAF-batched, zero path recomputation during drag) ---
  const onDragPointerDown = (e: React.PointerEvent) => {
    if (!hasSelection || !canvasEl) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    isDragging.current = true
    didDrag.current = false
    lastDragPos.current = { x: e.clientX, y: e.clientY }
    pendingCanvasDelta.current = { dx: 0, dy: 0 }
    totalCanvasDelta.current = { dx: 0, dy: 0 }
    pushUndoSnapshot()
    // Initialise the drag offset in the store so DrawingLayer starts tracking
    useLassoStore.getState().setDragOffset({ canvasDx: 0, canvasDy: 0, ids: selectedStrokeIds })
  }

  const onDragPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || !lastDragPos.current || !canvasEl) return
    e.stopPropagation()

    const screenDx = e.clientX - lastDragPos.current.x
    const screenDy = e.clientY - lastDragPos.current.y
    lastDragPos.current = { x: e.clientX, y: e.clientY }
    if (Math.abs(screenDx) < 0.5 && Math.abs(screenDy) < 0.5) return

    didDrag.current = true
    const { dx, dy } = screenToCanvasDelta(screenDx, screenDy, canvasEl)
    pendingCanvasDelta.current.dx += dx
    pendingCanvasDelta.current.dy += dy
    totalCanvasDelta.current.dx += dx
    totalCanvasDelta.current.dy += dy

    // Flush to store at most once per animation frame
    if (rafHandle.current === null) {
      rafHandle.current = requestAnimationFrame(() => {
        rafHandle.current = null
        const { dx: fdx, dy: fdy } = pendingCanvasDelta.current
        pendingCanvasDelta.current = { dx: 0, dy: 0 }
        // Accumulate into existing offset (store might already have a value)
        const cur = useLassoStore.getState().dragOffset
        useLassoStore.getState().setDragOffset({
          canvasDx: (cur?.canvasDx ?? 0) + fdx,
          canvasDy: (cur?.canvasDy ?? 0) + fdy,
          ids: selectedStrokeIds,
        })
      })
    }
  }

  const onDragPointerUp = (e: React.PointerEvent) => {
    e.stopPropagation()
    isDragging.current = false
    lastDragPos.current = null

    // Cancel any pending RAF
    if (rafHandle.current !== null) {
      cancelAnimationFrame(rafHandle.current)
      rafHandle.current = null
    }

    if (!didDrag.current) {
      // Just a tap on the selection — deselect
      useLassoStore.getState().setDragOffset(null)
      clearSelection()
      return
    }

    // Commit the total accumulated delta to strokes and items, then clear the preview
    const { dx, dy } = totalCanvasDelta.current
    if (selectedStrokeIds.length > 0) moveStrokes(selectedStrokeIds, dx, dy)
    if (selectedItemIds.length > 0) {
      const { items, updateItemPosition } = useCanvasItemsStore.getState()
      for (const id of selectedItemIds) {
        const item = items.find((i) => i.id === id)
        if (item) updateItemPosition(id, item.x + dx, item.y + dy)
      }
    }
    useLassoStore.getState().setDragOffset(null)
  }

  // Subscribe reactively so the box re-renders on every RAF drag tick
  const dragOffset = useLassoStore((s) => s.dragOffset)

  // Convert canvas-space drag delta → screen-space so the fixed-position box follows
  let screenDx = 0
  let screenDy = 0
  if (dragOffset && canvasEl) {
    const rect = canvasEl.getBoundingClientRect()
    screenDx = dragOffset.canvasDx * (rect.width / canvasEl.offsetWidth)
    screenDy = dragOffset.canvasDy * (rect.height / canvasEl.offsetHeight)
  }

  const rawPenColor =
    (hasMixedStrokeTools ? penStrokes[0] : selectedStrokes[0])?.color ??
    PEN_PRESETS[penColorIndexRef.current]
  const currentPenColor = resolvePenColor(rawPenColor, effectiveMode)
  const currentHighlighterColor =
    highlighterStrokes[0]?.color ?? HIGHLIGHTER_PRESETS[highlighterColorIndexRef.current]

  const centerX = bounds ? (bounds.left + bounds.right) / 2 + screenDx : 0
  const menuTop = bounds ? bounds.bottom + SUBMENU_BELOW_GAP + screenDy : 0

  return (
    <>
      {/* Lasso drawing overlay */}
      {(isDrawing || drawingPoints.length > 0) && (
        <svg
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: Z_LASSO_OVERLAY,
          }}
        >
          {lassoPath && (
            <path
              d={lassoPath}
              fill="rgba(0,0,0,0.035)"
              stroke="rgba(0,0,0,0.4)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      )}

      {/* Drag handle + selection bounding box */}
      {hasSelection && bounds && (
        <div
          data-lasso-selection=""
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerUp}
          style={{
            position: 'fixed',
            left: bounds.left - 18 + screenDx,
            top: bounds.top - 18 + screenDy,
            width: bounds.right - bounds.left + 36,
            height: bounds.bottom - bounds.top + 36,
            border: '1.5px dashed rgba(0,0,0,0.11)',
            borderRadius: 18,
            cursor: isDragging.current ? 'grabbing' : 'grab',
            zIndex: Z_LASSO_OVERLAY,
          }}
        />
      )}

      {/* Selection submenu — centred below the bounding box */}
      <AnimatePresence>
        {hasSelection && bounds && (
          // Outer div handles the screen positioning + centering;
          // inner motion.div handles enter/exit animation only.
          <div
            data-lasso-selection=""
            style={{
              position: 'fixed',
              left: centerX,
              top: menuTop,
              transform: 'translateX(-50%)',
              zIndex: Z_LASSO_SUBMENU,
              pointerEvents: 'auto',
            }}
          >
            <motion.div
              key="lasso-submenu"
              initial={{ opacity: 0, scale: 0.94, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -4 }}
              transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
              style={{
                display: 'flex',
                alignItems: 'stretch',
                height: 44,
                background: 'var(--card-bg, #fff)',
                borderRadius: 22,
                boxShadow: card.shadow,
                fontFamily: font.family,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              {/* Color cycle — only for stroke selections */}
              {selectedStrokeIds.length > 0 && (
                <>
                  {hasMixedStrokeTools ? (
                    /* Mixed: pen circle + highlighter circle side-by-side */
                    <div style={{ display: 'flex', alignItems: 'stretch' }}>
                      <LassoBtn onClick={handlePenColor} title="Change pen color">
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            background: currentPenColor,
                            border: '2px solid rgba(0,0,0,0.12)',
                            flexShrink: 0,
                          }}
                        />
                      </LassoBtn>
                      <LassoBtn onClick={handleHighlighterColor} title="Change highlighter color">
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            background: currentHighlighterColor,
                            border: '2px solid rgba(0,0,0,0.12)',
                            flexShrink: 0,
                          }}
                        />
                      </LassoBtn>
                    </div>
                  ) : (
                    /* Single tool type: one circle */
                    <LassoBtn
                      onClick={highlighterStrokes.length > 0 ? handleHighlighterColor : handlePenColor}
                      title="Change color"
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: highlighterStrokes.length > 0 ? currentHighlighterColor : currentPenColor,
                          border: '2px solid rgba(0,0,0,0.12)',
                          flexShrink: 0,
                        }}
                      />
                    </LassoBtn>
                  )}

                  <Divider />
                </>
              )}

              {/* Duplicate */}
              <LassoBtn onClick={handleDuplicate} title="Duplicate" color={font.colorPrimary}>
                <Copy size={17} strokeWidth={2} />
              </LassoBtn>

              <Divider />

              {/* Delete */}
              <LassoBtn onClick={handleDelete} title="Delete" color="#e05555" destructive>
                <Trash2 size={17} strokeWidth={2} />
              </LassoBtn>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

function LassoBtn({
  onClick,
  title,
  color,
  destructive = false,
  children,
}: {
  onClick: () => void
  title: string
  color?: string
  destructive?: boolean
  children: React.ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  const hoverBg = destructive ? 'rgba(196, 78, 78, 0.072)' : 'rgba(0, 0, 0, 0.056)'
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        // No border-radius — the pill container's overflow:hidden clips the fill
        // to the pill shape, matching the UI customization toolbar style.
        height: '100%',
        minWidth: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        background: hovered ? hoverBg : 'transparent',
        cursor: 'pointer',
        padding: '0 12px',
        borderRadius: 0,
        color: color,
        transition: 'background 120ms ease',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        alignSelf: 'stretch',
        margin: '8px 0',
        background: 'var(--ui-divider-vertical, rgba(0,0,0,0.1))',
        flexShrink: 0,
      }}
    />
  )
}

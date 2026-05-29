import { useEffect, useRef, useState, type RefObject } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Copy, Trash2 } from 'lucide-react'
import { useLassoStore } from './useLassoStore'
import { useStrokesStore } from './strokesStore'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import {
  keepActiveLassoSelectionForPointer,
  resolveLassoCanvasEl,
} from './lassoPointerGuard'
import { useLassoSelectionScreenLayout } from './useLassoSelectionScreenLayout'
import { card, font } from '../styles/tokens'
import { HIGHLIGHTER_PRESETS, PEN_PRESETS, resolvePenColor } from './colorUtils'
import { useThemeStore } from '../theme/themeStore'
import { useEffectiveMode } from '../theme/useEffectiveMode'

const SUBMENU_BELOW_GAP = 32 // extra breathing room below the selection box

/** Below top-bar panels (30) and nested submenus (40+); above canvas content. */
const Z_LASSO_OVERLAY = 18
const Z_LASSO_SUBMENU = 19

type Props = {
  canvasRef: RefObject<HTMLDivElement | null>
}

/** Screen-space lasso draw path + selection submenu (selection box lives on canvas). */
export default function LassoOverlay({ canvasRef }: Props) {
  const drawingPoints = useLassoStore((s) => s.drawingPoints)
  const isDrawing = useLassoStore((s) => s.isDrawing)
  const selectedStrokeIds = useLassoStore((s) => s.selectedStrokeIds)
  const selectedItemIds = useLassoStore((s) => s.selectedItemIds)
  const clearSelection = useLassoStore((s) => s.clearSelection)

  const strokes = useStrokesStore((s) => s.strokes)
  const deleteLassoSelection = useLassoStore((s) => s.deleteSelection)
  const recolorStrokes = useStrokesStore((s) => s.recolorStrokes)
  const duplicateStrokes = useStrokesStore((s) => s.duplicateStrokes)

  const themeMode = useThemeStore((s) => s.mode)
  const effectiveMode = useEffectiveMode(themeMode)

  const penColorIndexRef = useRef(0)
  const highlighterColorIndexRef = useRef(0)

  const hasSelection = selectedStrokeIds.length > 0 || selectedItemIds.length > 0

  const selectedStrokes = strokes.filter((s) => selectedStrokeIds.includes(s.id))

  const screenLayout = useLassoSelectionScreenLayout(
    canvasRef,
    hasSelection,
    selectedStrokeIds,
    selectedItemIds,
  )

  const lassoPath = drawingPoints.length > 1
    ? drawingPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z'
    : null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearSelection()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clearSelection])

  useEffect(() => {
    if (!hasSelection) return
    const stillExist = selectedStrokeIds.every((id) => strokes.some((s) => s.id === id))
    if (!stillExist) clearSelection()
  }, [strokes, selectedStrokeIds, hasSelection, clearSelection])

  useEffect(() => {
    if (!hasSelection) return

    function handlePointerDown(e: PointerEvent) {
      const canvas = canvasRef.current ?? resolveLassoCanvasEl(e.target)
      if (
        keepActiveLassoSelectionForPointer(e.clientX, e.clientY, e.target, canvas)
      ) {
        return
      }
      useLassoStore.getState().clearSelection()
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [hasSelection, canvasRef])

  const penStrokes = selectedStrokes.filter((s) => s.tool === 'pen')
  const highlighterStrokes = selectedStrokes.filter((s) => s.tool === 'highlighter')
  const penStrokeIds = penStrokes.map((s) => s.id)
  const highlighterStrokeIds = highlighterStrokes.map((s) => s.id)
  const hasMixedStrokeTools = penStrokes.length > 0 && highlighterStrokes.length > 0

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
      useLassoStore.setState({ selectedItemIds: [] })
    }
  }

  const bounds = screenLayout
  const centerX = bounds ? (bounds.left + bounds.right) / 2 : 0
  const menuTop = bounds ? bounds.bottom + SUBMENU_BELOW_GAP : 0

  const rawPenColor =
    (hasMixedStrokeTools ? penStrokes[0] : selectedStrokes[0])?.color ??
    PEN_PRESETS[penColorIndexRef.current]
  const currentPenColor = resolvePenColor(rawPenColor, effectiveMode)
  const currentHighlighterColor =
    highlighterStrokes[0]?.color ?? HIGHLIGHTER_PRESETS[highlighterColorIndexRef.current]

  return (
    <>
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
              fill="var(--lasso-draw-fill)"
              stroke="var(--lasso-draw-stroke)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      )}

      <AnimatePresence>
        {hasSelection && bounds && (
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
              {selectedStrokeIds.length > 0 && (
                <>
                  {hasMixedStrokeTools ? (
                    <div style={{ display: 'flex', alignItems: 'stretch' }}>
                      <LassoBtn onClick={handlePenColor} title="Change pen color">
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            background: currentPenColor,
                            border: '2px solid var(--lasso-swatch-ring)',
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
                            border: '2px solid var(--lasso-swatch-ring)',
                            flexShrink: 0,
                          }}
                        />
                      </LassoBtn>
                    </div>
                  ) : (
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
                          border: '2px solid var(--lasso-swatch-ring)',
                          flexShrink: 0,
                        }}
                      />
                    </LassoBtn>
                  )}

                  <Divider />
                </>
              )}

              <LassoBtn onClick={handleDuplicate} title="Duplicate" color={font.colorPrimary}>
                <Copy size={17} strokeWidth={2} />
              </LassoBtn>

              <Divider />

              <LassoBtn onClick={() => deleteLassoSelection()} title="Delete" color="#e05555" destructive>
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
  const hoverBg = destructive ? 'var(--menu-row-destructive-hover)' : 'var(--menu-row-hover-fill)'
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
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

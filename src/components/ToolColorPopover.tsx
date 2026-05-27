import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { font } from '../styles/tokens'
import {
  HIGHLIGHTER_PRESETS,
  PEN_PRESETS,
  penInkMatches,
  resolveHighlighterColor,
  resolvePenColor,
} from '../drawing/colorUtils'
import { playSubmenuHover, runSubmenuClick } from '../sound/submenuSound'
import { SubmenuSoundScope } from './SubmenuSoundScope'
import { useToolStore } from '../drawing/toolStore'
import { useThemeStore } from '../theme/themeStore'
import { useEffectiveMode } from '../theme/useEffectiveMode'

type ToolColorPopoverProps = {
  tool: 'pen' | 'highlighter'
}

/** Apple-style dissolve — single panel, no crossfade overlap. */
const TOOL_SWITCH_EASE = [0.25, 0.1, 0.25, 1] as const

const TOOL_SWITCH_MOTION = {
  initial: { opacity: 0.68, filter: 'blur(1.5px)', scale: 0.992 },
  animate: { opacity: 1, filter: 'blur(0px)', scale: 1 },
  transition: {
    opacity: { duration: 0.22, ease: TOOL_SWITCH_EASE },
    filter: { duration: 0.28, ease: TOOL_SWITCH_EASE },
    scale: { duration: 0.22, ease: TOOL_SWITCH_EASE },
  },
}

function ColorSwatches({
  presets,
  currentColor,
  onSelect,
  swatchColor,
  matchesPreset,
}: {
  presets: readonly string[]
  currentColor: string
  onSelect: (color: string) => void
  swatchColor: (preset: string) => string
  matchesPreset?: (current: string, preset: string) => boolean
}) {
  const isSelected =
    matchesPreset ??
    ((current: string, preset: string) =>
      current.toLowerCase() === preset.toLowerCase())

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: 4,
        borderRadius: 999,
        width: 'fit-content',
        background: 'var(--tool-settings-swatch-track-bg)',
      }}
    >
      {presets.map((preset) => {
        const selected = isSelected(currentColor, preset)
        const displayColor = swatchColor(preset)
        return (
          <button
            key={preset}
            type="button"
            aria-label="Preset color"
            aria-pressed={selected}
            onMouseEnter={() => playSubmenuHover()}
            onClick={() => runSubmenuClick(() => onSelect(preset))}
            style={{
              width: 26,
              height: 26,
              flexShrink: 0,
              borderRadius: '50%',
              background: displayColor,
              border: selected
                ? '2px solid var(--ui-text)'
                : '1.5px solid rgba(255, 255, 255, 0.85)',
              boxShadow: selected
                ? 'inset 0 0 0 1px rgba(255, 255, 255, 0.35)'
                : '0 1px 2px rgba(0, 0, 0, 0.08)',
              cursor: 'pointer',
              padding: 0,
              outline: 'none',
              transition: 'border-color 150ms ease, box-shadow 150ms ease',
            }}
          />
        )
      })}
    </div>
  )
}

function SizeControl({
  min,
  max,
  value,
  onChange,
}: {
  min: number
  max: number
  value: number
  onChange: (size: number) => void
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const [dragging, setDragging] = useState(false)
  const range = max - min
  const ratio = range > 0 ? (value - min) / range : 0
  const fillOpacity = 0.28 + ratio * 0.72

  const setFromClientX = useCallback(
    (clientX: number) => {
      const el = barRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0) return
      const t = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      onChange(min + Math.round(t * range))
    },
    [min, onChange, range],
  )

  useEffect(() => {
    const el = barRef.current
    if (!el) return

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      e.stopPropagation()
      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (Math.abs(delta) < 0.5) return
      const direction = delta > 0 ? -1 : 1
      onChange(Math.min(max, Math.max(min, value + direction)))
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [max, min, onChange, value])

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingRef.current = true
    setDragging(true)
    setFromClientX(e.clientX)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    setFromClientX(e.clientX)
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    draggingRef.current = false
    setDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      onChange(Math.min(max, value + 1))
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      onChange(Math.max(min, value - 1))
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 0,
        width: '100%',
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: font.colorFaint,
          flexShrink: 0,
          width: 28,
        }}
      >
        size
      </span>
      <div
        ref={barRef}
        className="tool-settings-size-bar"
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${Math.round(value)}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        style={{
          position: 'relative',
          flex: 1,
          minWidth: 0,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          touchAction: 'none',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'relative',
            width: '100%',
            height: 8,
            borderRadius: 999,
            overflow: 'hidden',
            background: 'var(--tool-settings-track-bg)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${ratio * 100}%`,
              borderRadius: 999,
              background: 'var(--tool-settings-size-fill)',
              opacity: fillOpacity,
              transition: dragging
                ? 'none'
                : 'width 80ms ease-out, opacity 80ms ease-out',
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default function ToolColorPopover({ tool }: ToolColorPopoverProps) {
  const isPen = tool === 'pen'
  const themeMode = useThemeStore((s) => s.mode)
  const effectiveMode = useEffectiveMode(themeMode)
  const penColor = useToolStore((s) => s.penColor)
  const penSize = useToolStore((s) => s.penSize)
  const highlighterColor = useToolStore((s) => s.highlighterColor)
  const highlighterSize = useToolStore((s) => s.highlighterSize)
  const setPenColor = useToolStore((s) => s.setPenColor)
  const setPenSize = useToolStore((s) => s.setPenSize)
  const setHighlighterColor = useToolStore((s) => s.setHighlighterColor)
  const setHighlighterSize = useToolStore((s) => s.setHighlighterSize)

  return (
    <div
      data-tool-settings=""
      style={{
        padding: '12px 12px 12px',
        fontFamily: font.family,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <SubmenuSoundScope>
        <div className="tool-settings-switch-host">
          <motion.div
            key={tool}
            className="tool-settings-switch"
            {...TOOL_SWITCH_MOTION}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              alignItems: 'center',
              transformOrigin: 'center center',
            }}
          >
            <ColorSwatches
              presets={isPen ? PEN_PRESETS : HIGHLIGHTER_PRESETS}
              currentColor={isPen ? penColor : highlighterColor}
              onSelect={isPen ? setPenColor : setHighlighterColor}
              swatchColor={(preset) =>
                isPen
                  ? resolvePenColor(preset, effectiveMode)
                  : resolveHighlighterColor(preset, effectiveMode)
              }
              matchesPreset={isPen ? penInkMatches : undefined}
            />
            <SizeControl
              min={isPen ? 2 : 12}
              max={isPen ? 12 : 32}
              value={isPen ? penSize : highlighterSize}
              onChange={isPen ? setPenSize : setHighlighterSize}
            />
          </motion.div>
        </div>
      </SubmenuSoundScope>
    </div>
  )
}

import { useShortcutUiStore } from '../shortcuts/shortcutUiStore'
import { useToolStore } from './toolStore'
import { CANVAS_HEIGHT, CANVAS_WIDTH } from './canvasDimensions'

let stylusInputSeen = false
let spaceDrawHeld = false

/** Set once a stylus / Apple Pencil input is observed this session. */
export function noteStylusInput(): void {
  stylusInputSeen = true
}

export function hasStylusInput(): boolean {
  return stylusInputSeen
}

export function setSpaceDrawHeld(held: boolean): void {
  spaceDrawHeld = held
}

export function isSpaceDrawHeld(): boolean {
  return spaceDrawHeld
}

/** Desktop draw mode: pen FAB open and no stylus this session. */
export function isDesktopPenDrawMode(): boolean {
  if (hasStylusInput()) return false
  return useShortcutUiStore.getState().toolPalette?.isOpen() ?? false
}

/** Pen hover menu pointer (Pencil, or mouse while desktop pen FAB is open). */
export function isPenMenuPointer(event: PointerEvent): boolean {
  if (isPenInput(event)) return true
  if (event.pointerType === 'mouse' && isDesktopPenDrawMode()) return true
  return false
}

/** Drawing tools active — desktop FAB, stylus session, or pen/highlighter/erase selected. */
export function isPenDrawMode(): boolean {
  if (useShortcutUiStore.getState().toolPalette?.isOpen()) return true
  if (hasStylusInput()) return true
  const mode = useToolStore.getState().mode
  return mode === 'pen' || mode === 'highlighter' || mode === 'erase'
}

/** Pointer eligible for space-bar drawing (hover / move without click). */
export function isSpaceDrawPointer(event: PointerEvent): boolean {
  if (isPenInput(event)) return true
  if (event.pointerType === 'mouse' && isDesktopPenDrawMode()) return true
  return false
}

/** Safari iPad: Pencil may report as pointerType "pen" or "touch" with fractional pressure. */
export function isPenInput(event: PointerEvent): boolean {
  if (event.pointerType === 'pen') return true
  if (
    event.pointerType === 'touch' &&
    event.pressure > 0 &&
    event.pressure < 1
  ) {
    return true
  }
  return false
}

export function isStylusTouch(touch: Touch): boolean {
  const touchType = (touch as Touch & { touchType?: string }).touchType
  return touchType === 'stylus' || touchType === 'pen'
}

/** True when a new pointer down may start a canvas stroke. */
export function canStartDrawingPointer(event: PointerEvent): boolean {
  if (event.pointerType === 'pen') {
    noteStylusInput()
    return true
  }
  if (isPenInput(event)) {
    noteStylusInput()
    return true
  }
  if (event.pointerType === 'mouse') {
    return useShortcutUiStore.getState().toolPalette?.isOpen() ?? false
  }
  return false
}

export function isFingerTouch(touch: Touch): boolean {
  return !isStylusTouch(touch)
}

export function isCanvasCoordSane(
  x: number,
  y: number,
  width: number = CANVAS_WIDTH,
  height: number = CANVAS_HEIGHT,
): boolean {
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= -100 &&
    y >= -100 &&
    x <= width + 100 &&
    y <= height + 100
  )
}

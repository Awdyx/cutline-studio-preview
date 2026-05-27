import { isPhoneLayout } from '../platform/layoutProfile'
import { useCanvasEditStore } from '../canvasEdit/canvasEditStore'
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

/** Sync flag set when the pen FAB menu opens — do not use toolPalette.isOpen() (React ref). */
export function isToolPaletteOpen(): boolean {
  return useShortcutUiStore.getState().toolPaletteOpen
}

/** Phone: pen FAB open — finger draws on canvas instead of panning. */
export function isPhoneFingerDrawMode(): boolean {
  if (isPhoneLayout() && !useCanvasEditStore.getState().enabled) return false
  return isPhoneLayout() && isToolPaletteOpen()
}

/** Desktop draw mode: pen FAB open and no stylus this session. */
export function isDesktopPenDrawMode(): boolean {
  if (hasStylusInput()) return false
  return isToolPaletteOpen()
}

/** Pen hover menu pointer (Pencil, mouse while desktop pen FAB open, or phone finger while pen FAB open). */
export function isPenMenuPointer(event: PointerEvent): boolean {
  if (isPenInput(event)) return true
  if (event.pointerType === 'mouse' && isDesktopPenDrawMode()) return true
  if (event.pointerType === 'touch' && isPhoneFingerDrawMode()) return true
  return false
}

/** Drawing tools active — desktop FAB, stylus session, or pen/highlighter/erase selected. */
export function isPenDrawMode(): boolean {
  if (isToolPaletteOpen()) return true
  if (hasStylusInput()) return true
  const mode = useToolStore.getState().mode
  return mode === 'pen' || mode === 'highlighter' || mode === 'erase' || mode === 'lasso'
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
  if (isPhoneLayout() && !useCanvasEditStore.getState().enabled) return false
  if (event.pointerType === 'pen') {
    noteStylusInput()
    return true
  }
  if (isPenInput(event)) {
    noteStylusInput()
    return true
  }
  if (event.pointerType === 'mouse') {
    return isToolPaletteOpen()
  }
  if (event.pointerType === 'touch' && isPhoneFingerDrawMode()) {
    return true
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

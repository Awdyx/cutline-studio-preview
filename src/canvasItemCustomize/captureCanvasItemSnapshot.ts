import type { CanvasItemType } from '../canvasItems/types'
import { computeStagePlacement } from './computeStageLayout'

export type CanvasItemLiftRecord = {
  itemId: string
  fromX: number
  fromY: number
  fromScale: number
  x: number
  y: number
  scale: number
  screenWidth: number
  screenHeight: number
}

export type CanvasItemScreenBox = {
  left: number
  top: number
  width: number
  height: number
}

export function readCanvasItemShellElement(itemId: string): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>(`[data-item-id="${itemId}"]`)
}

/** On-canvas shell only (excludes the portaled customize lift). */
export function readCanvasItemOnCanvasShellElement(
  itemId: string,
  itemType?: string,
): HTMLElement | null {
  if (typeof document === 'undefined') return null
  if (itemType) {
    return document.querySelector<HTMLElement>(
      `[data-canvas-item="${itemType}"][data-item-id="${itemId}"]`,
    )
  }
  return document.querySelector<HTMLElement>(
    `[data-canvas-item][data-item-id="${itemId}"]`,
  )
}

export function refreshLiftReturnFromDom(
  itemId: string,
  itemType: string,
  layoutWidth: number,
  layoutHeight: number,
  lift: CanvasItemLiftRecord,
): CanvasItemLiftRecord {
  const el = readCanvasItemOnCanvasShellElement(itemId, itemType)
  const screen = readCanvasItemScreenBox(el)
  if (!screen) return lift
  return {
    ...lift,
    fromX: screen.left,
    fromY: screen.top,
    fromScale: screen.width / Math.max(1, layoutWidth),
  }
}

export function readCanvasItemScreenBox(
  el: HTMLElement | null,
): CanvasItemScreenBox | null {
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  }
}

export function buildLiftRecord(
  itemId: string,
  screen: CanvasItemScreenBox,
  layoutWidth: number,
  layoutHeight: number,
  itemType?: CanvasItemType,
): CanvasItemLiftRecord | null {
  if (screen.width <= 0 || screen.height <= 0) return null
  return refreshLiftTarget(
    {
      itemId,
      fromX: screen.left,
      fromY: screen.top,
      fromScale: screen.width / Math.max(1, layoutWidth),
      x: screen.left,
      y: screen.top,
      scale: screen.width / Math.max(1, layoutWidth),
      screenWidth: screen.width,
      screenHeight: screen.height,
    },
    layoutWidth,
    layoutHeight,
    itemType,
  )
}

export function refreshLiftTarget(
  lift: CanvasItemLiftRecord,
  layoutWidth: number,
  layoutHeight: number,
  itemType?: CanvasItemType,
): CanvasItemLiftRecord {
  const target = computeStagePlacement(
    lift.screenWidth,
    lift.screenHeight,
    layoutWidth,
    layoutHeight,
    itemType,
  )
  return { ...lift, x: target.left, y: target.top, scale: target.scale }
}

export function liftTransformCss(lift: {
  x: number
  y: number
  scale: number
}): string {
  return `translate3d(${lift.x}px, ${lift.y}px, 0) scale(${lift.scale})`
}

export function liftFromTransformCss(
  lift: Pick<CanvasItemLiftRecord, 'fromX' | 'fromY' | 'fromScale'>,
): string {
  return liftTransformCss({
    x: lift.fromX,
    y: lift.fromY,
    scale: lift.fromScale,
  })
}

export function liftToTransformCss(
  lift: Pick<CanvasItemLiftRecord, 'x' | 'y' | 'scale'>,
): string {
  return liftTransformCss(lift)
}

export function captureLiftFromDom(
  itemId: string,
  layoutWidth: number,
  layoutHeight: number,
  itemType?: CanvasItemType,
): CanvasItemLiftRecord | null {
  const el = readCanvasItemShellElement(itemId)
  const screen = readCanvasItemScreenBox(el)
  if (!screen) return null
  return buildLiftRecord(itemId, screen, layoutWidth, layoutHeight, itemType)
}

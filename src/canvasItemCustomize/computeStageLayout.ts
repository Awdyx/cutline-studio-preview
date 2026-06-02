import type { CanvasItemType } from '../canvasItems/types'
import { isPhoneLayout } from '../platform/layoutProfile'
import { PHONE_HEADER_BLOCK_HEIGHT } from '../styles/phoneChrome'

const TOOLBAR_CLEARANCE = 88
const PAD_X_DESKTOP = 56
const PAD_X_PHONE = 16
const PAD_TOP_DESKTOP = 120
const MEASURE_BUFFER = 24
const DEFAULT_TOOLBAR_MAX_WIDTH = 220

/** Gap between toolbar ↔ tray in canvas-item customize. */
export const CANVAS_CUSTOMIZE_CHROME_GAP = 28
/** Extra deadspace between lifted element bottom and the done/clipping row. */
export const CANVAS_CUSTOMIZE_ELEMENT_TOOLBAR_GAP = 44

/** Customize stage is this fraction of the item's on-canvas screen appearance. */
export const CANVAS_ITEM_CUSTOMIZE_STAGE_FACTOR = 0.9

export type StagePlacement = {
  left: number
  top: number
  scale: number
  visualWidth: number
  visualHeight: number
}

function estimateBottomChromePx(): number {
  const vh = window.innerHeight
  const trayPx = Math.min(540, Math.max(160, vh * 0.5 - 96))
  return 38 + CANVAS_CUSTOMIZE_CHROME_GAP + trayPx + 28 + MEASURE_BUFFER
}

let measuredBottomChromePx = estimateBottomChromePx()
let measuredToolbarMaxWidth = 0

/** Called from session UI when tray/toolbar mount or resize. */
export function setCanvasCustomizeBottomChromePx(px: number): void {
  measuredBottomChromePx = Math.max(200, Math.round(px))
}

export function setCanvasCustomizeToolbarMaxWidth(px: number): void {
  measuredToolbarMaxWidth = Math.max(120, Math.round(px))
}

function stageZone(): {
  padTop: number
  availW: number
  /** Height budget for the lifted element (excludes toolbar deadspace). */
  elementAvailH: number
} {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const padX = isPhoneLayout() ? PAD_X_PHONE : PAD_X_DESKTOP
  const padTop = isPhoneLayout()
    ? PHONE_HEADER_BLOCK_HEIGHT + TOOLBAR_CLEARANCE
    : PAD_TOP_DESKTOP
  const padBottom = measuredBottomChromePx
  const zoneH = Math.max(1, vh - padTop - padBottom)
  return {
    padTop,
    availW: Math.max(1, vw - padX * 2),
    elementAvailH: Math.max(
      1,
      zoneH - CANVAS_CUSTOMIZE_ELEMENT_TOOLBAR_GAP,
    ),
  }
}

function contentScale(sourceScreenWidth: number, itemCanvasWidth: number): number {
  return sourceScreenWidth / Math.max(1, itemCanvasWidth)
}

/** Stickies/images stay within the done/clipping row; hubs and spaces use the full stage. */
function capsCustomizeWidthToToolbar(itemType?: CanvasItemType): boolean {
  return itemType === 'sticky' || itemType === 'image'
}

export function computeStagePlacement(
  sourceScreenWidth: number,
  sourceScreenHeight: number,
  itemCanvasWidth: number,
  itemCanvasHeight: number,
  itemType?: CanvasItemType,
): StagePlacement {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const { padTop, availW, elementAvailH } = stageZone()
  const baseScale = contentScale(sourceScreenWidth, itemCanvasWidth)

  let scale = baseScale * CANVAS_ITEM_CUSTOMIZE_STAGE_FACTOR
  let visualWidth = itemCanvasWidth * scale
  let visualHeight = itemCanvasHeight * scale

  // Grow small on-canvas items toward the stage zone (deadspace reserved in elementAvailH).
  if (visualWidth < availW && visualHeight < elementAvailH) {
    const grow = Math.min(availW / visualWidth, elementAvailH / visualHeight)
    if (grow > 1) {
      scale *= grow
      visualWidth = itemCanvasWidth * scale
      visualHeight = itemCanvasHeight * scale
    }
  }

  if (visualWidth > availW || visualHeight > elementAvailH) {
    const shrink = Math.min(
      availW / visualWidth,
      elementAvailH / visualHeight,
      1,
    )
    scale *= shrink
    visualWidth = itemCanvasWidth * scale
    visualHeight = itemCanvasHeight * scale
  }

  const toolbarMax = measuredToolbarMaxWidth || DEFAULT_TOOLBAR_MAX_WIDTH
  if (capsCustomizeWidthToToolbar(itemType) && visualWidth > toolbarMax) {
    const wShrink = toolbarMax / visualWidth
    scale *= wShrink
    visualWidth = itemCanvasWidth * scale
    visualHeight = itemCanvasHeight * scale
  }

  const top = Math.max(
    padTop,
    vh -
      measuredBottomChromePx +
      MEASURE_BUFFER -
      CANVAS_CUSTOMIZE_ELEMENT_TOOLBAR_GAP -
      visualHeight,
  )

  return {
    left: (vw - visualWidth) / 2,
    top,
    scale,
    visualWidth,
    visualHeight,
  }
}

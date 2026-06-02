import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  studyHubMenuFocusFitPadding,
  studyHubMenuFocusScreenRect,
} from '../canvas/canvasCamera'
import { isPhoneLayout } from '../platform/layoutProfile'
import { STUDY_HUB_ASPECT } from './types'

const FOCUS_FIT_PADDING_X = 40
const FOCUS_FIT_PADDING_X_PHONE = 12
const FOCUS_FIT_PADDING_TOP_DESKTOP = 56
const FOCUS_FIT_PADDING_BOTTOM = 48

export const STUDY_HUB_SCRATCH_PAD_GAP = 16
export const STUDY_HUB_SCRATCH_PAD_TRANSITION_MS = 480
export const STUDY_HUB_SCRATCH_PAD_EASE = [0.22, 1, 0.36, 1] as const

/** Minimum scratch-pad width while split — scales down on narrow viewports. */
const SCRATCH_PAD_MIN_WIDTH = 120
const SCRATCH_PAD_MIN_WIDTH_RATIO = 0.22

/** Minimum study-widget width while split — scales down on narrow viewports. */
const HUB_PANEL_MIN_WIDTH = 280
const HUB_PANEL_MIN_WIDTH_RATIO = 0.35

export const STUDY_HUB_SCRATCH_SPLIT_HANDLE_WIDTH = 12

export type StudyHubMenuFocusLayout = {
  container: { left: number; top: number; width: number; height: number }
  hub: { width: number; height: number }
  scratch: { left: number; width: number; height: number }
}

type MenuFocusAvailBounds = {
  wrapperLeft: number
  wrapperTop: number
  availW: number
  availH: number
  paddingX: number
  paddingTop: number
}

function viewportWrapperSize(ref: ReactZoomPanPinchContentRef): {
  width: number
  height: number
} | null {
  const wrapper = ref.instance.wrapperComponent
  if (!wrapper) return null
  const width = wrapper.offsetWidth
  const height = wrapper.offsetHeight
  if (width <= 0 || height <= 0) return null
  return { width, height }
}

function menuFocusAvailBounds(
  ref: ReactZoomPanPinchContentRef,
): MenuFocusAvailBounds | null {
  const size = viewportWrapperSize(ref)
  const wrapper = ref.instance.wrapperComponent
  if (!size || !wrapper) return null

  const wrapperBounds = wrapper.getBoundingClientRect()
  const { fitPaddingTop, fitPaddingBottom } = studyHubMenuFocusFitPadding()
  const paddingX = isPhoneLayout() ? FOCUS_FIT_PADDING_X_PHONE : FOCUS_FIT_PADDING_X
  const paddingTop = fitPaddingTop ?? FOCUS_FIT_PADDING_TOP_DESKTOP
  const paddingBottom = fitPaddingBottom ?? FOCUS_FIT_PADDING_BOTTOM

  return {
    wrapperLeft: wrapperBounds.left,
    wrapperTop: wrapperBounds.top,
    availW: Math.max(1, size.width - paddingX * 2),
    availH: Math.max(1, size.height - paddingTop - paddingBottom),
    paddingX,
    paddingTop,
  }
}

function hubSizeWithinBounds(width: number, maxHeight: number): {
  width: number
  height: number
} {
  let hubW = Math.max(1, width)
  let hubH = hubW / STUDY_HUB_ASPECT
  if (hubH > maxHeight) {
    hubH = maxHeight
    hubW = hubH * STUDY_HUB_ASPECT
  }
  return { width: hubW, height: hubH }
}

function minScratchWidth(availW: number): number {
  return Math.min(280, Math.max(SCRATCH_PAD_MIN_WIDTH, availW * SCRATCH_PAD_MIN_WIDTH_RATIO))
}

function minHubPanelWidth(availW: number): number {
  const splittable = Math.max(1, availW - STUDY_HUB_SCRATCH_PAD_GAP)
  return Math.min(
    520,
    Math.max(HUB_PANEL_MIN_WIDTH, splittable * HUB_PANEL_MIN_WIDTH_RATIO),
  )
}

export type StudyHubMenuFocusSplitBounds = {
  splittableW: number
  scratchMin: number
  scratchMax: number
}

export function studyHubMenuFocusSplitBounds(availW: number): StudyHubMenuFocusSplitBounds {
  const splittableW = Math.max(1, availW - STUDY_HUB_SCRATCH_PAD_GAP)
  const scratchMin = minScratchWidth(availW)
  const scratchMax = Math.max(scratchMin, splittableW - minHubPanelWidth(availW))
  return { splittableW, scratchMin, scratchMax }
}

export function scratchWidthFromSplitShare(
  availW: number,
  share: number,
): number {
  const { scratchMin, scratchMax } = studyHubMenuFocusSplitBounds(availW)
  const t = Math.max(0, Math.min(1, share))
  return scratchMin + t * (scratchMax - scratchMin)
}

export function splitShareFromScratchWidth(
  availW: number,
  scratchW: number,
): number {
  const { scratchMin, scratchMax } = studyHubMenuFocusSplitBounds(availW)
  if (scratchMax <= scratchMin) return 0.5
  const t = (scratchW - scratchMin) / (scratchMax - scratchMin)
  return Math.max(0, Math.min(1, t))
}

function splitPanelHeight(
  soloRect: Pick<DOMRect, 'width' | 'height'>,
  availW: number,
  availH: number,
): number {
  if (soloRect.height > 0) return soloRect.height
  const scratchMin = minScratchWidth(availW)
  const maxHubW = Math.max(1, availW - STUDY_HUB_SCRATCH_PAD_GAP - scratchMin)
  return hubSizeWithinBounds(Math.min(soloRect.width, maxHubW), availH).height
}

function defaultScratchSplitShare(
  availW: number,
  soloHubWidth: number,
): number {
  const scratchMin = minScratchWidth(availW)
  const maxHubW = Math.max(1, availW - STUDY_HUB_SCRATCH_PAD_GAP - scratchMin)
  const hubW = Math.min(soloHubWidth, maxHubW)
  const scratchW = Math.max(0, availW - hubW - STUDY_HUB_SCRATCH_PAD_GAP)
  return splitShareFromScratchWidth(availW, scratchW)
}

function layoutFromHubRect(
  hubRect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
): StudyHubMenuFocusLayout {
  const hub = { width: hubRect.width, height: hubRect.height }
  return {
    container: {
      left: hubRect.left,
      top: hubRect.top,
      width: hubRect.width,
      height: hubRect.height,
    },
    hub,
    scratch: {
      left: hub.width + STUDY_HUB_SCRATCH_PAD_GAP,
      width: 0,
      height: hub.height,
    },
  }
}

function responsiveSoloLayout(
  ref: ReactZoomPanPinchContentRef,
): StudyHubMenuFocusLayout | null {
  const focusRect = studyHubMenuFocusScreenRect(ref)
  if (!focusRect) return null
  return layoutFromHubRect(focusRect)
}

function responsiveSplitLayout(
  ref: ReactZoomPanPinchContentRef,
  scratchSplitShare: number | null,
): StudyHubMenuFocusLayout | null {
  const bounds = menuFocusAvailBounds(ref)
  const soloRect = studyHubMenuFocusScreenRect(ref)
  if (!bounds || !soloRect) return null

  const panelHeight = splitPanelHeight(soloRect, bounds.availW, bounds.availH)
  const share =
    scratchSplitShare ?? defaultScratchSplitShare(bounds.availW, soloRect.width)
  const scratchW = scratchWidthFromSplitShare(bounds.availW, share)
  const hubW = Math.max(
    minHubPanelWidth(bounds.availW),
    bounds.availW - STUDY_HUB_SCRATCH_PAD_GAP - scratchW,
  )
  const hub = { width: hubW, height: panelHeight }
  const scratchLeft = hub.width + STUDY_HUB_SCRATCH_PAD_GAP
  const scratchActualW = Math.max(0, bounds.availW - scratchLeft)
  const top =
    bounds.wrapperTop +
    bounds.paddingTop +
    Math.max(0, (bounds.availH - hub.height) / 2)

  return {
    container: {
      left: bounds.wrapperLeft + bounds.paddingX,
      top,
      width: bounds.availW,
      height: hub.height,
    },
    hub,
    scratch: {
      left: scratchLeft,
      width: scratchActualW,
      height: hub.height,
    },
  }
}

export function computeStudyHubMenuFocusLayout(
  hubRect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  scratchPadOpen: boolean,
  ref: ReactZoomPanPinchContentRef | null,
  options?: { responsive?: boolean; scratchSplitShare?: number | null },
): StudyHubMenuFocusLayout {
  const closed = layoutFromHubRect(hubRect)
  const splitShare = options?.scratchSplitShare ?? null

  if (!ref || !options?.responsive) {
    if (!scratchPadOpen || !ref) return closed
    return responsiveSplitLayout(ref, splitShare) ?? closed
  }

  if (scratchPadOpen) {
    return responsiveSplitLayout(ref, splitShare) ?? closed
  }

  return responsiveSoloLayout(ref) ?? closed
}

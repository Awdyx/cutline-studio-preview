import html2canvas from 'html2canvas'
import { CANVAS_ORIGINAL_HEIGHT, CANVAS_ORIGINAL_WIDTH } from '../drawing/canvasDimensions'
import type { FlattenSegmentPlan } from './flattenPlan'

function isMeshElement(el: HTMLElement, canvasEl: HTMLElement): boolean {
  if (el === canvasEl) return true
  return el.hasAttribute('data-mesh-blob')
}

function isAlwaysIgnored(el: HTMLElement, liveItemIds: ReadonlySet<string>): boolean {
  if (el.closest('[data-lock-layer="annotation"]') !== null) return true
  if (el.closest('[data-lock-sticky-annotation]') !== null) return true
  if (el.closest('[data-lock-flatten-skip]') !== null) return true

  const itemRoot = el.closest('[data-item-id]')
  if (itemRoot instanceof HTMLElement) {
    const itemId = itemRoot.getAttribute('data-item-id')
    if (itemId && liveItemIds.has(itemId)) return true
  }

  return false
}

function shouldIncludeElement(
  el: HTMLElement,
  canvasEl: HTMLElement,
  segment: FlattenSegmentPlan,
  liveItemIds: ReadonlySet<string>,
): boolean {
  if (isAlwaysIgnored(el, liveItemIds)) return false

  if (segment.includeMesh && isMeshElement(el, canvasEl)) return true

  if (segment.includeCommittedStrokes) {
    return el.closest('[data-lock-stroke-layer="committed"]') !== null
  }

  const itemRoot = el.closest('[data-item-id]')
  if (itemRoot instanceof HTMLElement) {
    const itemId = itemRoot.getAttribute('data-item-id')
    return !!itemId && segment.itemIds.includes(itemId)
  }

  return false
}

export async function captureFlattenSegment(
  canvasEl: HTMLElement,
  segment: FlattenSegmentPlan,
  liveItemIds: ReadonlySet<string>,
): Promise<string | null> {
  try {
    const canvas = await html2canvas(canvasEl, {
      width: CANVAS_ORIGINAL_WIDTH,
      height: CANVAS_ORIGINAL_HEIGHT,
      scale: 1,
      useCORS: true,
      logging: false,
      backgroundColor: null,
      ignoreElements: (el) => {
        if (!(el instanceof HTMLElement)) return true
        return !shouldIncludeElement(el, canvasEl, segment, liveItemIds)
      },
    })
    return canvas.toDataURL('image/webp', 0.92)
  } catch (err) {
    console.warn('[canvas-lock] flatten segment capture failed', segment.id, err)
    return null
  }
}

export async function captureFlattenSegments(
  canvasEl: HTMLElement,
  plans: FlattenSegmentPlan[],
  liveItemIds: ReadonlySet<string>,
): Promise<{ id: string; zIndex: number; dataUrl: string }[]> {
  const captured: { id: string; zIndex: number; dataUrl: string }[] = []

  for (const plan of plans) {
    const dataUrl = await captureFlattenSegment(canvasEl, plan, liveItemIds)
    if (dataUrl) {
      captured.push({ id: plan.id, zIndex: plan.zIndex, dataUrl })
    }
  }

  return captured
}

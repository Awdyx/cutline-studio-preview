import html2canvas from 'html2canvas'

const SNAPSHOT_TARGET_WIDTH = 400

export async function captureCanvasSnapshot(
  canvasEl: HTMLElement,
): Promise<string | null> {
  try {
    const scale = Math.min(1, SNAPSHOT_TARGET_WIDTH / canvasEl.offsetWidth)
    const canvasBg =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--canvas-bg')
        .trim() || '#f5f4f0'

    const canvas = await html2canvas(canvasEl, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: canvasBg,
      ignoreElements: (el) =>
        el.hasAttribute('data-space-transition') ||
        el.hasAttribute('data-space-back-pill'),
    })
    return canvas.toDataURL('image/jpeg', 0.72)
  } catch (err) {
    console.warn('[spaces] snapshot capture failed', err)
    return null
  }
}

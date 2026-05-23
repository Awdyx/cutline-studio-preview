import { useEffect, useRef, type RefObject } from 'react'

/**
 * Promote the pan/zoom layer once after first paint — mirrors what a space
 * enter/exit opacity cycle does before chrome menus animate smoothly.
 */
export function useCanvasCompositorWarmup(
  canvasRef: RefObject<HTMLDivElement | null>,
  ready: boolean,
) {
  const doneRef = useRef(false)

  useEffect(() => {
    if (!ready || doneRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return

    const layer = canvas.closest('.react-transform-component') as HTMLElement | null
    if (!layer) return

    doneRef.current = true

    const prevWillChange = layer.style.willChange
    layer.style.willChange = 'transform, opacity'
    layer.style.opacity = '0.999'
    void layer.offsetHeight

    requestAnimationFrame(() => {
      layer.style.opacity = '1'
      requestAnimationFrame(() => {
        layer.style.willChange = prevWillChange
      })
    })
  }, [ready, canvasRef])
}

import { useLayoutEffect } from 'react'
import {
  itemExtendsPastActiveCanvas,
  strokeExtendsOutsideActiveCanvas,
} from '../spaces/activeCanvasLayout'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import { useStrokesStore } from '../drawing/strokesStore'
import { useLassoStore } from '../drawing/useLassoStore'

/** Lift studio-centre clip while strokes or items extend past the editable bounds. */
export function useStudioCentreStrokeBleed(): boolean {
  const strokes = useStrokesStore((s) => s.strokes)
  const annotationStrokes = useStrokesStore((s) => s.annotationStrokes)
  const activeStroke = useStrokesStore((s) => s.activeStroke)
  const lassoDragActive = useLassoStore((s) => s.dragOffset != null)
  const items = useCanvasItemsStore((s) => s.items)

  const bleed =
    lassoDragActive ||
    activeStroke != null ||
    strokes.some(strokeExtendsOutsideActiveCanvas) ||
    annotationStrokes.some(strokeExtendsOutsideActiveCanvas) ||
    items.some((item) => itemExtendsPastActiveCanvas(item, items))

  useLayoutEffect(() => {
    document.documentElement.toggleAttribute('data-studio-strokes-bleed', bleed)
    return () => {
      document.documentElement.removeAttribute('data-studio-strokes-bleed')
    }
  }, [bleed])

  return bleed
}

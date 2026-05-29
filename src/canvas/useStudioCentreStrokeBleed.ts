import { useLayoutEffect } from 'react'
import { strokeExtendsOutsideStudioCentre } from './studioCentre'
import { useStrokesStore } from '../drawing/strokesStore'
import { useLassoStore } from '../drawing/useLassoStore'

/** Lift studio-centre clip while strokes extend past the editable bounds. */
export function useStudioCentreStrokeBleed(): boolean {
  const strokes = useStrokesStore((s) => s.strokes)
  const annotationStrokes = useStrokesStore((s) => s.annotationStrokes)
  const activeStroke = useStrokesStore((s) => s.activeStroke)
  const lassoDragActive = useLassoStore((s) => s.dragOffset != null)

  const bleed =
    lassoDragActive ||
    activeStroke != null ||
    strokes.some(strokeExtendsOutsideStudioCentre) ||
    annotationStrokes.some(strokeExtendsOutsideStudioCentre)

  useLayoutEffect(() => {
    document.documentElement.toggleAttribute('data-studio-strokes-bleed', bleed)
    return () => {
      document.documentElement.removeAttribute('data-studio-strokes-bleed')
    }
  }, [bleed])

  return bleed
}

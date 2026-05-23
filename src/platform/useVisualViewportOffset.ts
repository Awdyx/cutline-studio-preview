import { useLayoutEffect, useState } from 'react'

/** iOS Safari shifts the visual viewport when the software keyboard opens; fixed UI must follow. */
export function useVisualViewportOffset() {
  const [offsetTop, setOffsetTop] = useState(0)

  useLayoutEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => setOffsetTop(vv.offsetTop)
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return offsetTop
}

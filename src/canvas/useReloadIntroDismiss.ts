import { useEffect } from 'react'
import { useReloadIntroStore } from './reloadIntroStore'

function isReloadIntroBlockingInput(): boolean {
  const phase = useReloadIntroStore.getState().phase
  return phase === 'armed' || phase === 'revealing'
}

/** Click anywhere or Esc while the reload intro is armed. */
export function useReloadIntroDismiss() {
  const phase = useReloadIntroStore((s) => s.phase)

  useEffect(() => {
    if (!isReloadIntroBlockingInput()) return

    const dismiss = () => {
      useReloadIntroStore.getState().dismiss()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (useReloadIntroStore.getState().phase !== 'armed') return
      if (e.key !== 'Escape') return
      e.preventDefault()
      dismiss()
    }

    const onPointerDown = (e: PointerEvent) => {
      if (!isReloadIntroBlockingInput()) return
      if (useReloadIntroStore.getState().phase === 'armed') {
        dismiss()
      }
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown, { capture: true })
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown, { capture: true })
    }
  }, [phase])
}

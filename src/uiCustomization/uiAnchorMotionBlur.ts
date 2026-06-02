/** Motion-blur pulse during customize focus / lift (matches ui-anchor-motion-blur CSS). */
export function pulseUiAnchorMotionBlur(el: HTMLElement): void {
  const target =
    el.querySelector<HTMLElement>('[data-ui-customize-motion-surface]') ?? el
  target.removeAttribute('data-ui-anchor-motion')
  requestAnimationFrame(() => {
    target.setAttribute('data-ui-anchor-motion', '1')
    const onEnd = (event: AnimationEvent) => {
      if (
        event.target !== target ||
        event.animationName !== 'ui-anchor-motion-blur'
      ) {
        return
      }
      target.removeAttribute('data-ui-anchor-motion')
      target.removeEventListener('animationend', onEnd)
      target.removeEventListener('animationcancel', onEnd)
    }
    target.addEventListener('animationend', onEnd)
    target.addEventListener('animationcancel', onEnd)
  })
}

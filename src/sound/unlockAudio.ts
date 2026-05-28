import { idleAfterFirstPaint, isTouchFirstDevice } from '../platform/compositor'
import { resumePreviewAudioContext } from '../music/previewAudioEffects'
import { backgroundMusic } from './backgroundMusic'
import { resumeAudioContext, setMasterOutputGain } from './soundEngine'
import { SFX_ON_GAIN } from './soundLevels'
import { useSoundStore } from './soundStore'

let touchAudioPrimed = false

function applyTouchSfxGain(): void {
  const { muted, hydrated } = useSoundStore.getState()
  if (!hydrated) return
  setMasterOutputGain(muted ? 0 : SFX_ON_GAIN)
}

/** Resume audio contexts and retry background music after a user gesture. */
export function unlockAudioFromUserGesture(): void {
  void resumeAudioContext().then(applyTouchSfxGain)
  void resumePreviewAudioContext()

  if (isTouchFirstDevice()) {
    void backgroundMusic.resumeContext()
    if (touchAudioPrimed) return
    touchAudioPrimed = true
    void idleAfterFirstPaint(400).then(() => {
      backgroundMusic.unlock()
    })
    return
  }

  void backgroundMusic.resumeContext()
  backgroundMusic.unlock()
}

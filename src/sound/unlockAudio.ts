import { idleAfterFirstPaint, isTouchFirstDevice } from '../platform/compositor'
import {
  resumePreviewAudioContext,
  TRACK_PREVIEW_TRIGGER,
} from '../music/previewAudioEffects'
import { backgroundMusic } from './backgroundMusic'
import { resumeAudioContext, setMasterOutputGain } from './soundEngine'
import { SFX_ON_GAIN } from './soundLevels'
import { useSoundStore } from './soundStore'

let touchAudioPrimed = false

function isTrackPreviewTrigger(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(`[${TRACK_PREVIEW_TRIGGER}]`) != null
  )
}

function applyTouchSfxGain(): void {
  const { muted, hydrated } = useSoundStore.getState()
  if (!hydrated) return
  setMasterOutputGain(muted ? 0 : SFX_ON_GAIN)
}

/** Resume audio contexts and retry background music after a user gesture. */
export function unlockAudioFromUserGesture(event?: Event): void {
  void resumeAudioContext().then(applyTouchSfxGain)
  void resumePreviewAudioContext()
  void backgroundMusic.resumeContext()

  if (isTrackPreviewTrigger(event?.target ?? null)) {
    return
  }

  if (isTouchFirstDevice()) {
    if (touchAudioPrimed) return
    touchAudioPrimed = true
    void idleAfterFirstPaint(400).then(() => {
      backgroundMusic.unlock()
    })
    return
  }

  backgroundMusic.unlock()
}

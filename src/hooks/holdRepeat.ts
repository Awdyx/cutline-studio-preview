export type HoldRepeatOptions = {
  /** Delay before repeats begin (ms). */
  initialMs?: number
  /** Interval between repeats (ms). */
  intervalMs?: number
  /** Run `tick` immediately when the hold starts. */
  fireImmediately?: boolean
  /** When this returns false, pending/ongoing repeats stop without another tick. */
  whileActive?: () => boolean
}

export type HoldRepeatHandle = {
  stop: () => void
}

const DEFAULT_INITIAL_MS = 380
const DEFAULT_INTERVAL_MS = 55

/** Step `tick` once after a short hold, then on an interval until `stop()` is called. */
export function startHoldRepeat(
  tick: () => void,
  options?: HoldRepeatOptions,
): HoldRepeatHandle {
  const initialMs = options?.initialMs ?? DEFAULT_INITIAL_MS
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS
  const fireImmediately = options?.fireImmediately ?? false
  const whileActive = options?.whileActive

  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let intervalId: ReturnType<typeof setInterval> | null = null
  let stopped = false

  const stop = () => {
    if (stopped) return
    stopped = true
    if (timeoutId != null) clearTimeout(timeoutId)
    if (intervalId != null) clearInterval(intervalId)
    timeoutId = null
    intervalId = null
  }

  const stillActive = () => whileActive == null || whileActive()

  const runTick = () => {
    if (stopped) return
    if (!stillActive()) {
      stop()
      return
    }
    tick()
  }

  if (fireImmediately) runTick()

  timeoutId = setTimeout(() => {
    timeoutId = null
    if (stopped) return
    if (!stillActive()) {
      stop()
      return
    }
    runTick()
    intervalId = setInterval(runTick, intervalMs)
  }, initialMs)

  return { stop }
}

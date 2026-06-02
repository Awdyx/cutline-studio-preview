/** Whether a profile / picker song preview currently owns ambient music. */
let sessionActive = false

export function isTrackPreviewSessionActive(): boolean {
  return sessionActive
}

/** Mark preview active. Returns true only on the first begin in a row. */
export function markTrackPreviewSessionStarted(): boolean {
  if (sessionActive) return false
  sessionActive = true
  return true
}

/** Mark preview inactive. Returns true only when a session was actually open. */
export function markTrackPreviewSessionEnded(): boolean {
  if (!sessionActive) return false
  sessionActive = false
  return true
}

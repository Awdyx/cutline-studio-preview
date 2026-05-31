import type { AppDestination } from './appDestinationStore'

/** Space titles and destination chrome stay permanently active. */
export function useAppDestinationActive(destination: AppDestination): boolean {
  void destination
  return true
}

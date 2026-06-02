import { playSound } from './playSound'

/** Overview zoom-out engaged — soft downward lens pull. */
export function playOverviewEnterSound(): void {
  playSound('overviewEnter')
}

/** Overview zoom-in dismissed — soft upward lens release. */
export function playOverviewExitSound(): void {
  playSound('overviewExit')
}

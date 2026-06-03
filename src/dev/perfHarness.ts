import type { RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  focusItemOnCanvas,
  readCameraFromRef,
  writeCameraTransform,
} from '../canvas/canvasCamera'
import { getCanvasMinScale } from '../drawing/canvasDimensions'
import { studioCentreRect } from '../canvas/studioCentreRect'
import {
  clearPerfStudioItems,
  perfStudioFocusPoint,
  seedPerfStudioItems,
  type PerfSeedOptions,
} from './perfStudioSeed'

export type CutlinePerfHarness = {
  seed: (opts?: PerfSeedOptions) => Promise<void>
  clear: () => void
  panAway: () => void
  panToStudio: () => void
  runPanScenario: () => Promise<void>
  /** One-liner for Safari — seed then pan away → pan back (no console await). */
  profile: (opts?: PerfSeedOptions) => Promise<void>
  help: () => void
}

declare global {
  interface Window {
    __cutlinePerf?: CutlinePerfHarness
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function sampleFrameTimes(durationMs: number): Promise<{
  count: number
  p50: number
  p95: number
  max: number
}> {
  return new Promise((resolve) => {
    const deltas: number[] = []
    let last = performance.now()
    const stopAt = last + durationMs

    const tick = (now: number) => {
      deltas.push(now - last)
      last = now
      if (now < stopAt) {
        requestAnimationFrame(tick)
        return
      }
      deltas.sort((a, b) => a - b)
      resolve({
        count: deltas.length,
        p50: deltas[Math.floor(deltas.length * 0.5)] ?? 0,
        p95: deltas[Math.floor(deltas.length * 0.95)] ?? 0,
        max: deltas[deltas.length - 1] ?? 0,
      })
    }

    requestAnimationFrame(tick)
  })
}

export function registerPerfHarness(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
): () => void {
  if (!import.meta.env.DEV) return () => {}

  const panAway = () => {
    const ref = transformRef.current
    if (!ref) {
      console.warn('[perf] transform ref not ready')
      return
    }
    const wrapper = ref.instance.wrapperComponent
    const w = wrapper?.clientWidth ?? window.innerWidth
    const h = wrapper?.clientHeight ?? window.innerHeight
    const scale = readCameraFromRef(ref)?.scale ?? getCanvasMinScale(w, h)
    performance.mark('cutline-perf-pan-away-start')
    writeCameraTransform(ref, w * 0.35, h * 0.35, scale, 650)
  }

  const panToStudio = () => {
    const ref = transformRef.current
    if (!ref) {
      console.warn('[perf] transform ref not ready')
      return
    }
    performance.mark('cutline-perf-pan-studio-start')
    focusItemOnCanvas(ref, studioCentreRect(), {
      mainCanvasPlate: true,
      animationMs: 650,
      curved: true,
      onComplete: () => {
        performance.mark('cutline-perf-pan-studio-end')
        try {
          performance.measure(
            'cutline-perf-pan-to-studio',
            'cutline-perf-pan-studio-start',
            'cutline-perf-pan-studio-end',
          )
          const m = performance.getEntriesByName('cutline-perf-pan-to-studio').at(-1)
          if (m) console.info(`[perf] pan to studio: ${m.duration.toFixed(1)}ms`)
        } catch {
          // ignore duplicate measure
        }
      },
    })
  }

  const runPanScenario = async () => {
    performance.mark('cutline-perf-scenario-start')
    panAway()
    await sleep(750)
    panToStudio()
    const frames = await sampleFrameTimes(820)
    await sleep(80)
    performance.mark('cutline-perf-scenario-end')
    try {
      performance.measure(
        'cutline-perf-scenario',
        'cutline-perf-scenario-start',
        'cutline-perf-scenario-end',
      )
    } catch {
      // ignore
    }
    console.info(
      `[perf] pan-back frames (${frames.count}): p50=${frames.p50.toFixed(1)}ms p95=${frames.p95.toFixed(1)}ms max=${frames.max.toFixed(1)}ms — target ~8.3ms for 120fps`,
    )
  }

  const harness: CutlinePerfHarness = {
    async seed(opts) {
      const result = await seedPerfStudioItems(opts)
      console.info('[perf] seeded canvas items', result)
      console.info('[perf] centre your view on the studio, then run pan scenario')
      await sleep(300)
      panToStudio()
    },
    clear() {
      clearPerfStudioItems()
      console.info('[perf] cleared items')
    },
    panAway,
    panToStudio,
    runPanScenario,
    async profile(opts) {
      const result = await seedPerfStudioItems(opts)
      console.info('[perf] seeded canvas items', result)
      await sleep(1200)
      await runPanScenario()
    },
    help() {
      console.info(`
Cutline perf harness (dev only)

Safari: paste ONE line only (multi-line + await breaks the console):
  __cutlinePerf.profile()

Chrome: start Performance recording, then:
  await __cutlinePerf.profile()

Or run steps separately (one line at a time in Safari):
  __cutlinePerf.help()
  __cutlinePerf.seed()
  __cutlinePerf.runPanScenario()

Commands:
  __cutlinePerf.profile({ perType: 12 })     // 52 items + pan scenario
  __cutlinePerf.seed()                       // items only (returns Promise)
  __cutlinePerf.runPanScenario()             // pan away → pan back
  __cutlinePerf.clear()
  __cutlinePerf.panAway() / __cutlinePerf.panToStudio()

Studio centre (canvas coords): ${JSON.stringify(perfStudioFocusPoint())}
`)
    },
  }

  window.__cutlinePerf = harness
  console.info('[perf] loaded — run __cutlinePerf.help()')

  return () => {
    delete window.__cutlinePerf
  }
}

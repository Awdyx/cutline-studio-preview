import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { playSound } from '../sound/playSound'
import UiPinTray from '../uiCustomization/UiPinTray'
import {
  UI_CUSTOMIZE_CHROME_PANEL_ENTER,
  UI_CUSTOMIZE_CHROME_PANEL_EXIT,
  UI_CUSTOMIZE_CHROME_PANEL_SPRING,
  UI_CUSTOMIZE_VIGNETTE_ENTER,
  UI_CUSTOMIZE_VIGNETTE_EXIT,
} from '../uiCustomization/canvasItemCustomizeLayout'
import { useUiCustomizationStore } from '../uiCustomization/uiCustomizationStore'
import { canvasItemUiAnchorId } from '../uiCustomization/types'
import CanvasItemCustomizeToolbar from './CanvasItemCustomizeToolbar'
import { setCanvasCustomizeBottomChromePx, setCanvasCustomizeToolbarMaxWidth, CANVAS_CUSTOMIZE_CHROME_GAP } from './computeStageLayout'
import { refreshLiftTarget } from './captureCanvasItemSnapshot'
import { useCanvasItemsStore } from '../canvasItems/canvasItemsStore'
import {
  useCanvasCustomizeActive,
  useCanvasCustomizeStore,
} from './canvasCustomizeStore'

const PANEL_BOTTOM_INSET =
  'max(28px, calc(env(safe-area-inset-bottom, 0px) + 28px))'

function syncCanvasCustomizeDocumentAttrs(
  customizeOpen: boolean,
  blurDelegated: boolean,
) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (customizeOpen) {
    root.setAttribute('data-ui-focused', '1')
    root.setAttribute('data-ui-canvas-item-customize-focused', '1')
    if (blurDelegated) {
      root.setAttribute('data-canvas-blur-delegated', '1')
    } else {
      root.removeAttribute('data-canvas-blur-delegated')
    }
  } else {
    root.removeAttribute('data-ui-canvas-item-customize-focused')
    root.removeAttribute('data-canvas-blur-delegated')
    const ui = useUiCustomizationStore.getState()
    if (!ui.focusedAnchorId || !useCanvasCustomizeStore.getState().active) {
      if (!ui.focusedAnchorId) root.removeAttribute('data-ui-focused')
    }
  }
}

export default function CanvasItemCustomizeSession() {
  const active = useCanvasCustomizeActive()
  const exiting = useCanvasCustomizeStore((s) => s.exiting)
  const enterPhase = useCanvasCustomizeStore((s) => s.enterPhase)
  const itemId = useCanvasCustomizeStore((s) => s.itemId)
  const sessionVisible = Boolean(
    (active || exiting) &&
      itemId &&
      (exiting ||
        enterPhase === 'staging' ||
        enterPhase === 'lifting' ||
        enterPhase === 'live'),
  )
  const customizeDocumentOpen = Boolean(
    (active || exiting) && itemId && enterPhase !== 'idle',
  )
  const blurDelegated = Boolean(
    exiting || enterPhase === 'lifting' || enterPhase === 'live',
  )
  const showEnterChrome = Boolean(
    (active || exiting) &&
      itemId &&
      (exiting ||
        enterPhase === 'staging' ||
        enterPhase === 'lifting' ||
        enterPhase === 'live'),
  )
  const focusedAnchorId = itemId ? canvasItemUiAnchorId(itemId) : null
  const editing = useUiCustomizationStore((s) => s.editing)
  const focusedAnchorClipped = useUiCustomizationStore((s) =>
    focusedAnchorId ? s.clippedAnchorIds.has(focusedAnchorId) : false,
  )
  const toggleAnchorClipping = useUiCustomizationStore(
    (s) => s.toggleAnchorClipping,
  )
  const dismiss = useCanvasCustomizeStore((s) => s.dismiss)
  const setSelectedPinId = useUiCustomizationStore((s) => s.setSelectedPinId)
  const chromeRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  const chromeHidden = exiting || enterPhase !== 'live'
  const vignetteEnterTransition = reduceMotion
    ? { opacity: { duration: 0.01 } }
    : UI_CUSTOMIZE_VIGNETTE_ENTER
  const vignetteExitTransition = reduceMotion
    ? { opacity: { duration: 0.01 } }
    : UI_CUSTOMIZE_VIGNETTE_EXIT
  const vignetteTransition = exiting
    ? vignetteExitTransition
    : vignetteEnterTransition
  const panelTransition = reduceMotion
    ? { duration: 0 }
    : chromeHidden
      ? UI_CUSTOMIZE_CHROME_PANEL_EXIT
      : UI_CUSTOMIZE_CHROME_PANEL_ENTER

  useLayoutEffect(() => {
    if (!showEnterChrome || !chromeRef.current) return
    const el = chromeRef.current
    const measure = () => {
      const rect = el.getBoundingClientRect()
      const bottomGap = Math.max(0, window.innerHeight - rect.top)
      setCanvasCustomizeBottomChromePx(bottomGap + 24)
      const toolbar = el.querySelector('[data-ui-customization-toolbar]')
      if (toolbar instanceof HTMLElement) {
        setCanvasCustomizeToolbarMaxWidth(toolbar.getBoundingClientRect().width)
      }

      const state = useCanvasCustomizeStore.getState()
      if (state.enterPhase !== 'staging' || !state.itemId || !state.lift) return
      const item = useCanvasItemsStore
        .getState()
        .items.find((i) => i.id === state.itemId)
      if (!item) return
      useCanvasCustomizeStore.setState({
        lift: refreshLiftTarget(state.lift, item.width, item.height, item.type),
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [showEnterChrome])

  useLayoutEffect(() => {
    syncCanvasCustomizeDocumentAttrs(customizeDocumentOpen, blurDelegated)
    return () => syncCanvasCustomizeDocumentAttrs(false, false)
  }, [customizeDocumentOpen, blurDelegated])

  const dismissSession = useCallback(() => {
    if (exiting) return
    setSelectedPinId(null)
    if (dismiss()) playSound('menuClose')
  }, [dismiss, exiting, setSelectedPinId])

  const onDone = useCallback(() => {
    if (exiting) return
    if (dismiss()) playSound('menuClose')
  }, [dismiss, exiting])

  const onToggleClipping = useCallback(() => {
    if (!focusedAnchorId || exiting) return
    toggleAnchorClipping(focusedAnchorId)
    playSound('menuOpen')
  }, [exiting, focusedAnchorId, toggleAnchorClipping])

  useEffect(() => {
    if (!sessionVisible || exiting) return

    const insideChrome = (el: Element) =>
      el.closest('[data-ui-canvas-item-customize-lift]') != null ||
      el.closest('[data-ui-pin]') != null ||
      el.closest('[data-ui-customization-tray]') != null ||
      el.closest('[data-ui-customization-toolbar]') != null ||
      el.closest('[data-ui-pin-toolbar]') != null ||
      el.closest('[data-ui-canvas-customize-scrim]') != null ||
      el.closest('[data-ui-customization-drag-ghost]') != null

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      if (useUiCustomizationStore.getState().pinDrag) return
      if (document.documentElement.hasAttribute('data-ui-pin-dragging')) return
      const target = event.target
      if (!(target instanceof Element)) return
      if (insideChrome(target)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      dismissSession()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [dismissSession, exiting, sessionVisible])

  if (!sessionVisible || !focusedAnchorId) return null

  return (
    <>
      <motion.div
        data-ui-customize-vignette=""
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: chromeHidden ? 0 : 1 }}
        transition={vignetteTransition}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 51,
          pointerEvents: 'none',
          background: 'var(--ui-customize-vignette)',
          willChange: 'opacity',
        }}
      />

      <motion.div
        aria-hidden
        data-ui-canvas-customize-scrim=""
        initial={{ opacity: 0 }}
        animate={{ opacity: chromeHidden ? 0 : 1 }}
        transition={vignetteTransition}
        onPointerDown={(e) => {
          if (exiting) return
          if (e.target !== e.currentTarget) return
          dismissSession()
        }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 51,
          pointerEvents: chromeHidden ? 'none' : 'auto',
          cursor: 'default',
          background: 'transparent',
        }}
      />

      {showEnterChrome ? (
        <motion.div
          ref={chromeRef}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{
          opacity: chromeHidden ? 0 : 1,
          y: chromeHidden ? 14 : 0,
          scale: chromeHidden ? 0.98 : 1,
        }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : chromeHidden
              ? panelTransition
              : UI_CUSTOMIZE_CHROME_PANEL_SPRING
        }
        style={{
          position: 'fixed',
          bottom: PANEL_BOTTOM_INSET,
          top: 'auto',
          left: 0,
          right: 0,
          zIndex: 55,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: CANVAS_CUSTOMIZE_CHROME_GAP,
          pointerEvents: 'none',
          willChange: 'opacity, transform',
        }}
      >
        <CanvasItemCustomizeToolbar
          focusedAnchorId={focusedAnchorId}
          focusedAnchorClipped={focusedAnchorClipped}
          onDone={onDone}
          onToggleClipping={onToggleClipping}
        />
        <UiPinTray open={editing} embedInCanvasCustomizeChrome />
        </motion.div>
      ) : null}
    </>
  )
}

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback, type RefObject } from 'react'
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchContentRef,
} from 'react-zoom-pan-pinch'
import DrawingLayer from './drawing/DrawingLayer'
import { useStudioCentreStrokeBleed } from './canvas/useStudioCentreStrokeBleed'
import { useDrawing } from './drawing/useDrawing'
import { usePenToolMenu } from './drawing/usePenToolMenu'
import PenToolPillMenu from './components/PenToolPillMenu'
import LassoOverlay from './drawing/LassoOverlay'
import LassoSelectionChrome from './drawing/LassoSelectionChrome'
import { AnimatePresence } from 'framer-motion'
import {
  canvasPanExcludedClasses,
  canvasTrackpadPanExcludedClasses,
} from './canvas/canvasNavigationStore'
import { useCanvasNavigationTracking } from './canvas/useCanvasNavigationTracking'
import { useCanvasSelectionPointer } from './canvas/useCanvasSelectionPointer'
import { useCanvasContextMenuPointer } from './canvas/useCanvasContextMenuPointer'
import TopBar from './components/TopBar'
import TauriWindowDragRegion from './components/TauriWindowDragRegion'
import NotificationsPanel from './components/NotificationsPanel'
import NewsPanel from './components/NewsPanel'
import ProfilePanel from './components/ProfilePanel'
import PlusFab from './components/PlusFab'
import PenFab from './components/PenFab'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useChromeTapPulse } from './hooks/useChromeTapPulse'
import { useSuppressChromeContextMenu } from './hooks/useSuppressChromeContextMenu'
import { useTouchUndoRedoGestures } from './hooks/useTouchUndoRedoGestures'
import { useBackgroundMusic } from './hooks/useBackgroundMusic'
import { usePanelSounds } from './hooks/usePanelSounds'
import { useThemeChangeFeedback } from './hooks/useThemeChangeFeedback'
import { useSoundStore } from './sound/soundStore'
import { playSound } from './sound/playSound'
import ActionToast from './components/ActionToast'
import ThemeChangePulse from './components/ThemeChangePulse'
import { clearHistory } from './canvasHistory/canvasHistory'
import { useStrokesStore } from './drawing/strokesStore'
import { useCanvasItemsStore } from './canvasItems/canvasItemsStore'
import { useLassoStore } from './drawing/useLassoStore'
import { useCanvasItemDragStore } from './canvasItems/canvasItemDragStore'
import StudyHubEphemeralOverlay from './canvasItems/StudyHubEphemeralOverlay'
import CanvasItemsLayer from './canvasItems/CanvasItemsLayer'
import CanvasItemZOrderMenu from './canvasItems/CanvasItemZOrderMenu'
import TextFontSizeFloatingMenu from './canvasItems/TextFontSizeFloatingMenu'
import SelectionBlurOverlay from './canvasItems/SelectionBlurOverlay'
import SelectionBlurCanvasBackdrop from './canvasItems/SelectionBlurCanvasBackdrop'
import LassoSelectionBlur from './canvasItems/LassoSelectionBlur'
import CanvasContextMenu from './components/CanvasContextMenu'
import { useCanvasFileHandlers } from './canvasItems/useCanvasFileHandlers'
import { useCanvasLockStore } from './canvasLock/canvasLockStore'
import { useCanvasEditStore } from './canvasEdit/canvasEditStore'
import { useQuickMenuStore } from './quickMenu/quickMenuStore'
import CanvasLockFlattenLayer from './canvasLock/CanvasLockFlattenLayer'
import { useCanvasLockFlatten } from './canvasLock/useCanvasLockFlatten'
import { useCanvasWorkspaceStore } from './spaces/canvasWorkspaceStore'
import PocketStripViewport from './spaces/PocketStripViewport'
import SpaceBackPill, { SPACE_BACK_PILL_MOTION, SPACE_BACK_PILL_PHONE_CLASS } from './components/SpaceBackPill'
import CutlineMenu from './components/CutlineMenu'
import { ComingSoonOverlay } from './components/ComingSoonOverlay'
import { NEWS_POSTS } from './content/news'
import type { Notification, NotificationTab, NewsTab } from './types'
import { useThemeCssVars } from './theme/useThemeCssVars'
import { useThemeStore } from './theme/themeStore'
import { useToolStore } from './drawing/toolStore'
import { useEffectiveMode } from './theme/useEffectiveMode'
import { stopActiveProfilePreviewPlayback } from './music/previewAudioEffects'
import { useProfileStore } from './profile/profileStore'
import { profileToTopBarUser } from './profile/profileUtils'
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CANVAS_MAX_SCALE,
  CANVAS_ZOOM_EDGE_PADDING,
  CANVAS_ZOOM_MIN_EDGE_PADDING,
  canvasLayoutHeight,
  canvasLayoutWidth,
  getCanvasHardMinScale,
} from './drawing/canvasDimensions'
import {
  CANVAS_WHEEL_ZOOM_STEP,
  clampToLibraryBounds,
  releaseZoomBounds,
} from './canvas/canvasCamera'
import { useBlockPagePinchZoom } from './canvas/useBlockPagePinchZoom'
import { useCanvasCursorWheelZoom } from './canvas/useCanvasCursorWheelZoom'
import { useCanvasViewport } from './canvas/useCanvasViewport'
import {
  useCanvasCompositorWarmup,
  useCanvasGestureCompositor,
} from './canvas/canvasCompositorLayer'
import CanvasSwapVeil from './canvas/CanvasSwapVeil'
import ReloadSpaceIntro from './canvas/ReloadSpaceIntro'
import { resolveReloadIntroCopy } from './canvas/reloadIntroCopy'
import { useReloadIntroStore } from './canvas/reloadIntroStore'
import CanvasPlateBoundsOverlay from './canvas/CanvasPlateBoundsOverlay'
import { useCanvasPanSession } from './canvas/useCanvasPanSession'
import { useCanvasZMenuTrackpadPan } from './canvas/useCanvasZMenuTrackpadPan'
import { useCanvasPanSound } from './canvas/useCanvasPanSound'
import { useCanvasZoomSound } from './canvas/useCanvasZoomSound'
import {
  recordCanvasZoomFrame,
  resetCanvasZoomVelocityTracking,
} from './canvas/canvasZoomVelocity'
import { useCanvasSelectionViewportPark } from './canvas/useCanvasSelectionViewportPark'
import {
  registerStudioCentreTransformRef,
} from './canvas/studioCentrePositionStore'
import { useStudioCentrePositionCssVars } from './canvas/useStudioCentrePositionCssVars'
import { blurStrayTextFocus } from './platform/textFocus'
import { idleAfterFirstPaint, isTouchFirstDevice } from './platform/compositor'
import { isPhoneLayout } from './platform/layoutProfile'
import { useLayoutProfile } from './hooks/useLayoutProfile'
import { useShortcutUiStore } from './shortcuts/shortcutUiStore'
import SettingsSubmenu from './components/SettingsSubmenu'
import { clientToCanvas } from './drawing/canvasCoords'
import type { StudySubjectId } from './canvasItems/types'
import { useUiCustomizationStore } from './uiCustomization/uiCustomizationStore'
import { CanvasItemCustomizeSession } from './canvasItemCustomize'
import UiCustomizationLayer from './uiCustomization/UiCustomizationLayer'
import { CHROME_OVERLAY_PORTAL_ID } from './platform/chromeOverlayPortal'
import { usePanMotionStore } from './panMotionStore'

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    avatar: { initial: 'S', color: '#9484b8' },
    actor: '@sofiacodes',
    message: '@sofiacodes commented on your HU canvas',
    timestamp: '2h ago',
    isUnread: true,
    type: 'mention',
  },
  {
    id: '2',
    avatar: { initial: 'C', color: '#6a9bc8' },
    message: 'New question added to CE Lecture 4',
    timestamp: '5h ago',
    isUnread: true,
    type: 'all',
  },
  {
    id: '3',
    avatar: { initial: 'J', color: '#c87a6a' },
    actor: '@j.wu_study',
    message: '@j.wu_study sent you a message: "Are we still meeting at 3?"',
    timestamp: '6h ago',
    isUnread: true,
    type: 'all',
  },
  {
    id: '4',
    avatar: { initial: 'A', color: '#7a8fc8' },
    actor: '@amira.path',
    message: '@amira.path mentioned you in Pathology Week 6 notes',
    timestamp: '8h ago',
    isUnread: true,
    type: 'mention',
  },
  {
    id: '5',
    avatar: { initial: 'L', color: '#8a7bc8' },
    actor: '@lena.anki',
    message: '@lena.anki replied to your comment on Anki deck tips',
    timestamp: '12h ago',
    isUnread: true,
    type: 'mention',
  },
  {
    id: '6',
    avatar: { initial: 'R', color: '#5cb88a' },
    actor: '@ryan.biochem',
    message: '@ryan.biochem shared "Biochem Finals Review" with you',
    timestamp: '1d ago',
    isUnread: false,
    type: 'all',
  },
  {
    id: '7',
    avatar: { initial: 'T', color: '#5cb88a' },
    actor: '@tom.notes',
    message: '@tom.notes shared "Biochem Finals" with you',
    timestamp: '1d ago',
    isUnread: false,
    type: 'all',
  },
  {
    id: '8',
    avatar: { initial: 'E', color: '#c8a86a' },
    actor: '@emma.pdf',
    message: '@emma.pdf sent you a message: "Thanks for the notes!"',
    timestamp: '1d ago',
    isUnread: false,
    type: 'all',
  },
  {
    id: '9',
    avatar: { initial: 'N', color: '#6a9bc8' },
    actor: '@noah.micro',
    message: '@noah.micro liked your canvas "Microbio Summary"',
    timestamp: '2d ago',
    isUnread: false,
    type: 'all',
  },
  {
    id: '10',
    avatar: { initial: 'K', color: '#9484b8' },
    actor: '@kai.surg',
    message: '@kai.surg mentioned you in Surgery rotation prep',
    timestamp: '2d ago',
    isUnread: false,
    type: 'mention',
  },
  {
    id: '11',
    avatar: { initial: 'D', color: '#7a8fc8' },
    actor: '@daniel.scan',
    message: '@daniel.scan sent you a message: "Can you send the PDF?"',
    timestamp: '3d ago',
    isUnread: false,
    type: 'all',
  },
  {
    id: '12',
    avatar: { initial: 'P', color: '#c87a6a' },
    actor: '@priya.group',
    message: '@priya.group joined your study group canvas',
    timestamp: '3d ago',
    isUnread: false,
    type: 'all',
  },
  {
    id: '13',
    avatar: { initial: 'H', color: '#8a7bc8' },
    actor: '@hannah.pharm',
    message: '@hannah.pharm commented on your Pharm flashcards',
    timestamp: '4d ago',
    isUnread: false,
    type: 'mention',
  },
  {
    id: '14',
    avatar: { initial: 'O', color: '#5cb88a' },
    actor: '@omar.lecture',
    message: '@omar.lecture sent you a message: "See you in lecture"',
    timestamp: '5d ago',
    isUnread: false,
    type: 'all',
  },
  {
    id: '15',
    avatar: { initial: 'Z', color: '#c8a86a' },
    actor: '@zara.maps',
    message: '@zara.maps exported a copy of your Anatomy mind map',
    timestamp: '1w ago',
    isUnread: false,
    type: 'all',
  },
]

type OpenPanel =
  | 'news'
  | 'notifications'
  | 'profile'
  | 'cutline'
  | null

function App() {
  useLayoutProfile()
  useCanvasPanSound()
  useCanvasZoomSound()

  const toolMode = useToolStore((s) => s.mode)
  useEffect(() => {
    document.documentElement.dataset.toolMode = toolMode
  }, [toolMode])

  const transformRef = useRef<ReactZoomPanPinchContentRef | null>(null)
  useCanvasNavigationTracking()
  const canvasSelectionPointer = useCanvasSelectionPointer(transformRef)
  const themeModeStore = useThemeStore((s) => s.mode)
  const effectiveMode = useEffectiveMode(themeModeStore)
  useThemeCssVars()
  useStudioCentrePositionCssVars()
  useThemeChangeFeedback(effectiveMode, themeModeStore)

  const pinchStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { viewportRef, viewportSize, minScale, onTransformInit, onHydrated } =
    useCanvasViewport(transformRef)
  const hardMinScale = useMemo(
    () => getCanvasHardMinScale(viewportSize.width, viewportSize.height),
    [viewportSize.width, viewportSize.height],
  )
  const canvasPanActive = usePanMotionStore((s) => s.canvasPanActive)
  const panExcluded = useMemo(
    () => canvasPanExcludedClasses(canvasPanActive),
    [canvasPanActive],
  )
  const trackpadPanExcluded = useMemo(
    () => canvasTrackpadPanExcludedClasses(canvasPanActive),
    [canvasPanActive],
  )
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const canvasContextMenuPointer = useCanvasContextMenuPointer(transformRef, canvasRef)
  const [canvasMount, setCanvasMount] = useState<HTMLDivElement | null>(null)
  const [appHydrated, setAppHydrated] = useState(false)
  const [penDown, setPenDown] = useState(false)
  const penMenu = usePenToolMenu(transformRef)
  useDrawing(canvasRef, transformRef, setPenDown, penMenu.bridgeRef, canvasMount)
  const strokeBleed = useStudioCentreStrokeBleed()
  useTouchUndoRedoGestures(penMenu.bridgeRef)

  const {
    imageInputRef,
    onImageInputChange,
    openImagePicker,
    spawnStickyAtViewportCenter,
    spawnTextAtViewportCenter,
    spawnSpaceAtViewportCenter,
    spawnStudyHubAtViewportCenter,
    spawnStudyHubAtCanvasPoint,
    spawnAtCanvasPoint,
  } = useCanvasFileHandlers(transformRef, viewportRef, canvasRef)

  const isInsideSpace = useCanvasWorkspaceStore((s) => s.activeCanvasId !== 'main')
  const activeSpaceId = useCanvasWorkspaceStore((s) =>
    s.activeCanvasId === 'main' ? null : s.activeCanvasId,
  )
  const activeLayoutWidth = canvasLayoutWidth()
  const activeLayoutHeight = canvasLayoutHeight()
  const canvasSwapMode = useCanvasWorkspaceStore((s) => s.canvasSwapMode)
  const canvasSwapPhase = useCanvasWorkspaceStore((s) => s.canvasSwapPhase)
  const canvasFadeOpacity = useCanvasWorkspaceStore((s) => s.canvasFadeOpacity)
  const canvasVeilOpacity = useCanvasWorkspaceStore((s) => s.canvasVeilOpacity)
  const canvasFadeMs = useCanvasWorkspaceStore((s) => s.canvasFadeMs)
  const canvasFadeEase = useCanvasWorkspaceStore((s) => s.canvasFadeEase)
  const canvasSwapBusy = useCanvasWorkspaceStore((s) => s.canvasSwapBusy)

  // Drive transitions from the store so per-mode ease (e.g. exit reveal) reaches the DOM.
  const swapTransition = `opacity ${canvasFadeMs}ms ${canvasFadeEase}`

  const showSpaceBackPill = isInsideSpace

  useLayoutEffect(() => {
    const root = document.documentElement
    if (isInsideSpace) {
      root.setAttribute('data-inside-space', '')
      root.style.setProperty('--canvas-width', `${viewportSize.width}px`)
      root.style.setProperty('--canvas-height', `${viewportSize.height}px`)
    } else {
      root.removeAttribute('data-inside-space')
      root.style.setProperty('--canvas-width', `${activeLayoutWidth}px`)
      root.style.setProperty('--canvas-height', `${activeLayoutHeight}px`)
    }
  }, [isInsideSpace, activeLayoutWidth, activeLayoutHeight, viewportSize.width, viewportSize.height])

  useLayoutEffect(() => {
    if (!appHydrated) return

    let cancelled = false
    const id = requestAnimationFrame(() => {
      if (cancelled) return
      const ref = transformRef.current
      if (!ref) return
      useCanvasWorkspaceStore.getState().applyCameraForActiveCanvas(ref)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [isInsideSpace, appHydrated, transformRef])

  useEffect(() => {
    registerStudioCentreTransformRef(transformRef)
    return () => registerStudioCentreTransformRef(null)
  }, [transformRef])

  useCanvasCompositorWarmup(
    canvasRef,
    transformRef,
    appHydrated && canvasMount !== null,
  )
  useCanvasGestureCompositor(canvasRef, transformRef)

  const handleExitSpace = () => {
    if (useCanvasWorkspaceStore.getState().canvasSwapBusy) return
    playSound('spaceExit')
    useCanvasWorkspaceStore
      .getState()
      .exitSpace(transformRef.current, canvasRef.current)
  }

  const transformMinScale = Math.max(
    hardMinScale - CANVAS_ZOOM_MIN_EDGE_PADDING,
    0.05,
  )
  const transformMaxScale = CANVAS_MAX_SCALE + CANVAS_ZOOM_EDGE_PADDING

  const itemDragActive = useCanvasItemDragStore((s) => s.activeItemId !== null)
  const lassoDragActive = useLassoStore((s) => s.dragOffset != null)
  const toolPaletteOpen = useShortcutUiStore((s) => s.toolPaletteOpen)
  const uiEditing = useUiCustomizationStore((s) => s.editing)

  const isPenDown =
    penDown || penMenu.state.phase !== 'idle' || itemDragActive
  const studyHubMenuFocusActive = useCanvasItemsStore(
    (s) =>
      s.menuFocusReturnCamera != null ||
      s.menuFocusEphemeralSubjectId != null,
  )
  const studyHubMenuFocusEngaged = useCanvasItemsStore(
    (s) =>
      s.menuFocusReturnCamera != null ||
      s.menuFocusEphemeralSubjectId != null ||
      s.menuFocusDismissing,
  )
  useEffect(() => {
    const el = document.documentElement
    if (studyHubMenuFocusEngaged) {
      el.setAttribute('data-study-hub-menu-focus-engaged', '')
    } else {
      el.removeAttribute('data-study-hub-menu-focus-engaged')
    }
  }, [studyHubMenuFocusEngaged])
  const penToolMenuOpen = penMenu.state.phase === 'open'
  useEffect(() => {
    const el = document.documentElement
    if (penToolMenuOpen) {
      el.setAttribute('data-pen-tool-menu-open', '')
    } else {
      el.removeAttribute('data-pen-tool-menu-open')
    }
  }, [penToolMenuOpen])
  const canvasGestureLocked =
    isPenDown ||
    (toolPaletteOpen && (!isTouchFirstDevice() || isPhoneLayout())) ||
    uiEditing
  useBlockPagePinchZoom()
  useCanvasCursorWheelZoom({
    transformRef,
    viewportRef,
    zoomExcluded: trackpadPanExcluded,
    onZoom: (ref) => {
      recordCanvasZoomFrame(ref)
      usePanMotionStore.getState().setZoomActive(true)
    },
    onZoomStop: (ref) => {
      usePanMotionStore.getState().setZoomActive(false)
      resetCanvasZoomVelocityTracking()
      if (zoomReleaseActive) releaseZoomBounds(ref, hardMinScale)
    },
    disabled: isPenDown,
    step: CANVAS_WHEEL_ZOOM_STEP,
  })
  const canvasPanSession = useCanvasPanSession()
  const zoomReleaseActive =
    !isInsideSpace && !studyHubMenuFocusEngaged
  useCanvasZMenuTrackpadPan({
    transformRef,
    disabled:
      isPenDown ||
      studyHubMenuFocusEngaged ||
      lassoDragActive,
    onPanFrame: canvasPanSession.onPanFrame,
    onPanStop: (ref) => canvasPanSession.onPanStop(ref, false),
  })
  useCanvasSelectionViewportPark(
    transformRef,
    isPenDown || studyHubMenuFocusEngaged || lassoDragActive || canvasSwapBusy,
  )
  const isCanvasLocked = useCanvasLockStore((s) => s.isLocked)
  const lockCanvas = useCanvasLockStore((s) => s.lockCanvas)
  const requestUnlock = useCanvasLockStore((s) => s.requestUnlock)

  useCanvasLockFlatten(canvasRef, isCanvasLocked)

  useEffect(() => {
    void (async () => {
      try {
        const touchFirst = isTouchFirstDevice()
        await useCanvasWorkspaceStore.getState().hydrate()
        if (touchFirst) await idleAfterFirstPaint(200)
        useCanvasItemsStore.getState().hydrate()
        useStrokesStore.getState().hydrate()
        useCanvasLockStore.getState().hydrate()
        useCanvasEditStore.getState().hydrate()
        if (touchFirst) await idleAfterFirstPaint(100)
        useQuickMenuStore.getState().hydrate()
        useUiCustomizationStore.getState().hydrate()
        useSoundStore.getState().hydrate()
        clearHistory()
        onHydrated()
      } catch (err) {
        console.error('[app] hydrate failed — continuing with defaults', err)
        try {
          useCanvasItemsStore.getState().hydrate()
          useStrokesStore.getState().hydrate()
          useCanvasLockStore.getState().hydrate()
          useCanvasEditStore.getState().hydrate()
          useQuickMenuStore.getState().hydrate()
          useUiCustomizationStore.getState().hydrate()
          useSoundStore.getState().hydrate()
          clearHistory()
        } catch {
          // last resort — still reveal UI so the tab is not stuck blank
        }
        onHydrated()
      } finally {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setAppHydrated(true))
        })
        blurStrayTextFocus()
      }
    })()

  }, [])

  const themeMode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)
  const profile = useProfileStore((s) => s.profile)
  const topBarUser = profileToTopBarUser(profile)

  const [openPanel, setOpenPanel] = useState<OpenPanel>(null)
  const [appNavComingSoon, setAppNavComingSoon] = useState(false)
  const [activeTab, setActiveTab] = useState<NotificationTab>('all')
  const [activeNewsTab, setActiveNewsTab] = useState<NewsTab>('all')
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS)
  const [seenNewsIds, setSeenNewsIds] = useState<Set<string>>(() => new Set())
  const [panelSeenNewsIds, setPanelSeenNewsIds] = useState<Set<string>>(() => new Set())
  const [badgeAckedNotifIds, setBadgeAckedNotifIds] = useState<Set<string>>(() => new Set())
  const prevOpenPanelRef = useRef<OpenPanel>(null)
  const suppressPanelSoundRef = useRef(false)
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  const [floatingSettingsPos, setFloatingSettingsPos] = useState<{ x: number; y: number } | null>(null)
  const floatingSettingsAnchorRef = useRef<HTMLDivElement>(null)

  function openOnly(panel: OpenPanel) {
    if (useUiCustomizationStore.getState().editing) return
    const ui = useShortcutUiStore.getState()
    ui.plusFab?.close({ silent: true })
    ui.toolPalette?.close({ silent: true })
    setOpenPanel((current) => {
      if (current === panel) {
        ui.dismissPeerChromeOverlays()
        return null
      }
      if (current !== null) {
        ui.dismissPeerChromeOverlays({ silent: true })
        suppressPanelSoundRef.current = true
      }
      return panel
    })
  }

  const closePanel = useCallback((opts?: { silent?: boolean }) => {
    void stopActiveProfilePreviewPlayback()
    if (opts?.silent) suppressPanelSoundRef.current = true
    useShortcutUiStore.getState().dismissPeerChromeOverlays(opts)
    setOpenPanel(null)
  }, [])

  const showAppNavComingSoon = useCallback(() => {
    closePanel({ silent: true })
    setAppNavComingSoon(true)
  }, [closePanel])
  useKeyboardShortcuts(openPanel, closePanel, transformRef)
  usePanelSounds(openPanel, suppressPanelSoundRef)
  useBackgroundMusic()
  useChromeTapPulse()
  useSuppressChromeContextMenu()

  useEffect(() => {
    useShortcutUiStore.getState().registerAppPanels({ close: closePanel })
    return () => useShortcutUiStore.getState().registerAppPanels(null)
  }, [closePanel])

  // Track mouse position for shortcuts that spawn near cursor.
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      lastMousePosRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', onMouseMove)
    return () => window.removeEventListener('mousemove', onMouseMove)
  }, [])

  useEffect(() => {
    const getMouseCanvasPos = () => {
      const { x, y } = lastMousePosRef.current
      return clientToCanvas(x, y, transformRef, canvasRef.current) ?? { x: 0, y: 0 }
    }

    useShortcutUiStore.getState().registerCanvasSpawn({
      spawnText: spawnTextAtViewportCenter,
      spawnSticky: spawnStickyAtViewportCenter,
      openImageAtMousePos: () => {
        const pos = getMouseCanvasPos()
        spawnAtCanvasPoint(pos.x, pos.y, 'image')
      },
      spawnStudyHub: (subjectId: string) => {
        spawnStudyHubAtViewportCenter(subjectId as StudySubjectId)
      },
    })
    return () => useShortcutUiStore.getState().registerCanvasSpawn(null)
  }, [spawnTextAtViewportCenter, spawnStickyAtViewportCenter, spawnAtCanvasPoint, spawnStudyHubAtViewportCenter, transformRef, canvasRef])

  // Register openPanel so keyboard shortcuts can open top-level panels.
  useEffect(() => {
    useShortcutUiStore.getState().registerOpenPanel(openOnly as (panel: 'notifications' | 'news' | 'profile') => void)
    return () => useShortcutUiStore.getState().registerOpenPanel(null)
  })

  // Register floating settings opener + closer.
  const floatingSettingsPosRef = useRef<{ x: number; y: number } | null>(null)
  floatingSettingsPosRef.current = floatingSettingsPos

  useEffect(() => {
    useShortcutUiStore.getState().registerOpenSettingsNearMouse(() => {
      setFloatingSettingsPos({ ...lastMousePosRef.current })
    })
    useShortcutUiStore.getState().registerCloseFloatingSettings(() => {
      if (!floatingSettingsPosRef.current) return false
      setFloatingSettingsPos(null)
      return true
    })
    return () => {
      useShortcutUiStore.getState().registerOpenSettingsNearMouse(null)
      useShortcutUiStore.getState().registerCloseFloatingSettings(null)
    }
  }, [])

  // Close floating settings on click outside.
  useEffect(() => {
    if (!floatingSettingsPos) return
    function handlePointerDown(e: PointerEvent) {
      const target = e.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-cutline-submenu="settings"]')) return
      setFloatingSettingsPos(null)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [floatingSettingsPos])

  useEffect(() => {
    const prev = prevOpenPanelRef.current
    const wasNotifications = prev === 'notifications'
    const isNotifications = openPanel === 'notifications'
    const wasNews = prev === 'news'
    const isNews = openPanel === 'news'

    if (isNotifications && !wasNotifications) {
      setBadgeAckedNotifIds((prevIds) => {
        const next = new Set(prevIds)
        notifications.filter((n) => n.isUnread).forEach((n) => next.add(n.id))
        return next
      })
    }

    if (wasNotifications && !isNotifications) {
      setNotifications((prevNotifications) =>
        prevNotifications.some((n) => n.isUnread)
          ? prevNotifications.map((n) => (n.isUnread ? { ...n, isUnread: false } : n))
          : prevNotifications,
      )
    }

    if (isNews && !wasNews) {
      setSeenNewsIds((prevIds) => {
        const unseen = NEWS_POSTS.filter((p) => p.isNew && !prevIds.has(p.id))
        if (unseen.length === 0) return prevIds
        const next = new Set(prevIds)
        unseen.forEach((p) => next.add(p.id))
        return next
      })
    }

    if (wasNews && !isNews) {
      setPanelSeenNewsIds((prevIds) => {
        const unseen = NEWS_POSTS.filter((p) => p.isNew && !prevIds.has(p.id))
        if (unseen.length === 0) return prevIds
        const next = new Set(prevIds)
        unseen.forEach((p) => next.add(p.id))
        return next
      })
    }

    prevOpenPanelRef.current = openPanel
  }, [openPanel, notifications])

  useEffect(() => {
    if (!appHydrated) return
    useReloadIntroStore.getState().arm(resolveReloadIntroCopy())
  }, [appHydrated])

  useEffect(() => {
    blurStrayTextFocus()
    const t = window.setTimeout(blurStrayTextFocus, 0)
    return () => window.clearTimeout(t)
  }, [])

  const unreadCount = notifications.filter(
    (n) => n.isUnread && !badgeAckedNotifIds.has(n.id),
  ).length
  const newsCount = NEWS_POSTS.filter((p) => p.isNew && !seenNewsIds.has(p.id)).length

  const pocketCanvasLayers = (
    <>
      <CanvasLockFlattenLayer />
      <CanvasItemsLayer plane="below" transformRef={transformRef} />
      <DrawingLayer band="committed-below" />
      <CanvasItemsLayer plane="above" transformRef={transformRef} />
      <DrawingLayer band="committed-above" />
      <CanvasItemsLayer plane="annotation" transformRef={transformRef} />
      <DrawingLayer band="annotation" />
      <DrawingLayer band="active" />
      <LassoSelectionBlur />
      <DrawingLayer band="lasso-lifted" />
      <LassoSelectionChrome canvasRef={canvasRef} />
      <SelectionBlurOverlay />
    </>
  )

  return (
    <div
      className="cutline-app-shell"
      data-ready={appHydrated || undefined}
    >
      <div ref={viewportRef} className="cutline-canvas-viewport">
        <div className="canvas-pan-shell" style={{ width: '100%', height: '100%', position: 'relative' }}>
          {isInsideSpace && activeSpaceId ? (
            <PocketStripViewport
              activeSpaceId={activeSpaceId}
              viewportWidth={viewportSize.width}
              viewportHeight={viewportSize.height}
              canvasRef={canvasRef}
              canvasFadeOpacity={canvasFadeOpacity}
              canvasSwapBusy={canvasSwapBusy}
              swapTransition={canvasSwapBusy ? swapTransition : undefined}
              onCanvasMount={setCanvasMount}
              selectionHandlers={canvasSelectionPointer}
              onContextMenu={canvasContextMenuPointer.onContextMenu}
              onDoubleClick={canvasContextMenuPointer.onDoubleClick}
            >
              {pocketCanvasLayers}
            </PocketStripViewport>
          ) : (
          <TransformWrapper
            ref={transformRef}
            disabled={isPenDown}
            initialScale={minScale}
            minScale={transformMinScale}
            maxScale={transformMaxScale}
            limitToBounds
            disablePadding
            centerZoomedOut={false}
            onInit={onTransformInit}
            onPanningStart={() => {
              usePanMotionStore.getState().setCanvasPanActive(true)
            }}
            onPanning={(ref) => {
              canvasPanSession.onPanFrame(ref)
            }}
            onPanningStop={(ref) => {
              canvasPanSession.onPanStop(ref)
            }}
            onZoom={(ref) => {
              recordCanvasZoomFrame(ref)
              usePanMotionStore.getState().setZoomActive(true)
            }}
            onPinch={(ref) => {
              recordCanvasZoomFrame(ref)
              usePanMotionStore.getState().setZoomActive(true)
              // Safety fallback: iPad touch events don't always fire onPinchStop
              // reliably. Reset a countdown on every pinch frame so zoom state clears.
              if (pinchStopTimer.current) clearTimeout(pinchStopTimer.current)
              pinchStopTimer.current = setTimeout(() => {
                pinchStopTimer.current = null
                usePanMotionStore.getState().setZoomActive(false)
                resetCanvasZoomVelocityTracking()
              }, 300)
            }}
            onZoomStop={(ref) => {
              if (zoomReleaseActive) releaseZoomBounds(ref, hardMinScale)
              else clampToLibraryBounds(ref)
              usePanMotionStore.getState().setZoomActive(false)
              resetCanvasZoomVelocityTracking()
            }}
            onPinchStop={(ref) => {
              if (zoomReleaseActive) releaseZoomBounds(ref, hardMinScale)
              else clampToLibraryBounds(ref)
              if (pinchStopTimer.current) {
                clearTimeout(pinchStopTimer.current)
                pinchStopTimer.current = null
              }
              usePanMotionStore.getState().setZoomActive(false)
              resetCanvasZoomVelocityTracking()
            }}
            wheel={{
              step: CANVAS_WHEEL_ZOOM_STEP,
              wheelDisabled: true,
              touchPadDisabled: true,
              activationKeys: (keys) =>
                keys.includes('Control') || keys.includes('Meta'),
            }}
            trackPadPanning={{
              disabled:
                isPenDown ||
                studyHubMenuFocusEngaged ||
                lassoDragActive,
              excluded: trackpadPanExcluded,
            }}
            panning={{
              velocityDisabled: true,
              disabled:
                canvasGestureLocked ||
                studyHubMenuFocusEngaged ||
                lassoDragActive,
              excluded: panExcluded,
            }}
            pinch={{
              disabled:
                isPenDown ||
                studyHubMenuFocusActive,
              excluded: panExcluded,
            }}
            velocityAnimation={{
              sensitivityMouse: 0.4,
              sensitivityTouch: 0.4,
              animationTime: 350,
              animationType: 'easeOut',
            }}
            doubleClick={{ disabled: true }}
          >
            <TransformComponent
              wrapperStyle={{
                width: viewportSize.width,
                height: viewportSize.height,
                overflow: 'hidden',
                touchAction: 'none',
              }}
              contentStyle={{
                width: activeLayoutWidth,
                height: activeLayoutHeight,
              }}
            >
              <div
                className="cutline-canvas-bg cutline-canvas-expanded"
                style={{
                  width: activeLayoutWidth,
                  height: activeLayoutHeight,
                  position: 'relative',
                  opacity: canvasFadeOpacity,
                  transition: canvasSwapBusy ? swapTransition : undefined,
                  pointerEvents: canvasSwapBusy ? 'none' : undefined,
                }}
              >
                <div
                  className="cutline-canvas-logical"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: CANVAS_WIDTH,
                    height: CANVAS_HEIGHT,
                  }}
                >
                  <div className="cutline-canvas-void-grid" aria-hidden />
                  <SelectionBlurCanvasBackdrop />
                </div>
                <div
                  ref={(node) => {
                    canvasRef.current = node
                    setCanvasMount(node)
                  }}
                  className="cutline-draw-target cutline-draw-target--positioned draw-target"
                  data-strokes-bleed={strokeBleed ? '' : undefined}
                  onPointerDown={canvasSelectionPointer.onPointerDown}
                  onPointerMove={canvasSelectionPointer.onPointerMove}
                  onPointerUp={canvasSelectionPointer.onPointerUp}
                  onPointerCancel={canvasSelectionPointer.onPointerCancel}
                  onContextMenu={canvasContextMenuPointer.onContextMenu}
                  onDoubleClick={canvasContextMenuPointer.onDoubleClick}
                >
                  <div className="cutline-studio-centre-surface">
                    <div className="studio-centre-content-inner">
                      <CanvasPlateBoundsOverlay destination="studio" />
                      {pocketCanvasLayers}
                    </div>
                  </div>
                </div>
              </div>
            </TransformComponent>
          </TransformWrapper>
          )}
        </div>

      <ReloadSpaceIntro />
      <ThemeChangePulse effectiveMode={effectiveMode} />
      </div>

      {canvasSwapBusy && (
        <CanvasSwapVeil
          opacity={canvasVeilOpacity}
          transition={swapTransition}
        />
      )}

      <ActionToast />

      <TauriWindowDragRegion />
      <TopBar
        user={topBarUser}
        unreadCount={unreadCount}
        cutlineMenuOpen={openPanel === 'cutline'}
        newsOpen={openPanel === 'news'}
        notificationsOpen={openPanel === 'notifications'}
        profileOpen={openPanel === 'profile'}
        phoneMenuOpen={openPanel !== null}
        transformRef={transformRef}
        onCutlineClick={() => openOnly('cutline')}
        newsCount={newsCount}
        onNewsClick={() => openOnly('news')}
        onNotificationClick={() => openOnly('notifications')}
        onProfileClick={() => openOnly('profile')}
      />

      <div
        id={CHROME_OVERLAY_PORTAL_ID}
        className="cutline-chrome-overlays"
        aria-hidden
      />

      <PenFab />

      <PenToolPillMenu
        state={penMenu.state}
        onCloseAnimationComplete={() => penMenu.bridgeRef.current.finishCloseAnimation()}
      />
      <LassoOverlay canvasRef={canvasRef} />
      <CanvasItemZOrderMenu />
      <TextFontSizeFloatingMenu />

      <CanvasContextMenu
        showSpaceOption={!isInsideSpace}
        onAddToCanvas={(type, canvasX, canvasY) => {
          spawnAtCanvasPoint(canvasX, canvasY, type)
        }}
        onStudySubjectSelect={(subjectId, canvasX, canvasY) => {
          spawnStudyHubAtCanvasPoint(canvasX, canvasY, subjectId)
        }}
      />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onImageInputChange}
      />

      <PlusFab
        showSpaceOption={!isInsideSpace}
        onAddToCanvas={(type) => {
          if (type === 'sticky') spawnStickyAtViewportCenter()
          else if (type === 'text') spawnTextAtViewportCenter()
          else if (type === 'image') openImagePicker()
          else if (type === 'space') spawnSpaceAtViewportCenter()
        }}
        onStudySubjectSelect={(subjectId) => {
          spawnStudyHubAtViewportCenter(subjectId)
        }}
      />

      {showSpaceBackPill && (
        <div
          className={SPACE_BACK_PILL_PHONE_CLASS}
          style={{
            ...SPACE_BACK_PILL_MOTION.style,
            opacity:
              canvasSwapMode === 'exit' && canvasSwapPhase === 'blank'
                ? canvasFadeOpacity
                : 1,
            transition:
              canvasSwapMode === 'exit' && canvasSwapPhase === 'blank'
                ? swapTransition
                : undefined,
            pointerEvents: canvasSwapBusy ? 'none' : undefined,
          }}
        >
          <SpaceBackPill onExit={handleExitSpace} />
        </div>
      )}

      <AnimatePresence>
        {openPanel === 'cutline' && (
          <CutlineMenu
            key="cutline"
            isOpen
            onClose={closePanel}
            onShowComingSoon={showAppNavComingSoon}
            mode={themeMode}
            onModeChange={setMode}
            isCanvasLocked={isCanvasLocked}
            showCanvasLock={!isInsideSpace}
            transformRef={transformRef}
            onToggleCanvasLock={() => {
              if (isCanvasLocked) requestUnlock()
              else lockCanvas()
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {openPanel === 'news' && (
          <NewsPanel
            key="news"
            isOpen
            onClose={closePanel}
            posts={NEWS_POSTS}
            panelSeenNewsIds={panelSeenNewsIds}
            activeTab={activeNewsTab}
            onTabChange={setActiveNewsTab}
            onPostClick={(id) => console.log('news post clicked', id)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {openPanel === 'notifications' && (
          <NotificationsPanel
            key="notifications"
            isOpen
            onClose={closePanel}
            notifications={notifications}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onNotificationClick={(id) => console.log('notification clicked', id)}
            onVisitActorCanvas={(handle) =>
              console.log('visit actor canvas', handle)
            }
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {openPanel === 'profile' && (
          <ProfilePanel
            key="profile"
            isOpen
            onClose={closePanel}
            onNavigate={(dest) => {
              if (dest === 'help') console.log('help & support')
            }}
            onSignOut={() => console.log('sign out')}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {appNavComingSoon && (
          <ComingSoonOverlay
            key="app-nav-coming-soon"
            onDismiss={() => setAppNavComingSoon(false)}
          />
        )}
      </AnimatePresence>

      <CanvasItemCustomizeSession />
      <UiCustomizationLayer transformRef={transformRef} />

      <StudyHubEphemeralOverlay transformRef={transformRef} />

      {/* Virtual anchor for keyboard-triggered floating settings menu */}
      <div
        ref={floatingSettingsAnchorRef}
        aria-hidden
        style={{
          position: 'fixed',
          pointerEvents: 'none',
          width: 0,
          height: 0,
          top: floatingSettingsPos?.y ?? 0,
          left: floatingSettingsPos?.x ?? 0,
        }}
      />

      <AnimatePresence>
        {floatingSettingsPos && (
          <SettingsSubmenu
            key="floating-settings"
            anchorRef={floatingSettingsAnchorRef as RefObject<HTMLElement | null>}
            mode={themeMode}
            onModeChange={setMode}
            onCloseMenu={() => setFloatingSettingsPos(null)}
            isCanvasLocked={isCanvasLocked}
            onToggleCanvasLock={() => {
              if (isCanvasLocked) requestUnlock()
              else lockCanvas()
            }}
            showCanvasLock={!isInsideSpace}
            onBack={() => setFloatingSettingsPos(null)}
            hideHints
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default App

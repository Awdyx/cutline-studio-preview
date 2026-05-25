import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchContentRef,
} from 'react-zoom-pan-pinch'
import DrawingLayer from './drawing/DrawingLayer'
import { useDrawing } from './drawing/useDrawing'
import { usePenToolMenu } from './drawing/usePenToolMenu'
import PenToolPillMenu from './components/PenToolPillMenu'
import { AnimatePresence, motion } from 'framer-motion'
import MotionIndicator from './MotionIndicator'
import TrailingVignette from './TrailingVignette'
import { usePanMotionHandler } from './usePanMotionHandler'
import {
  canvasPanExcludedClasses,
  useCanvasNavigationStore,
} from './canvas/canvasNavigationStore'
import { useCanvasNavigationTracking } from './canvas/useCanvasNavigationTracking'
import { useStudyHubCanvasPanCoordination } from './canvas/useStudyHubCanvasPanCoordination'
import { useCanvasSelectionPointer } from './canvas/useCanvasSelectionPointer'
import TopBar from './components/TopBar'
import NotificationsPanel from './components/NotificationsPanel'
import NewsPanel from './components/NewsPanel'
import ProfilePanel from './components/ProfilePanel'
import PlusFab from './components/PlusFab'
import PenFab from './components/PenFab'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
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
import { useCanvasItemDragStore } from './canvasItems/canvasItemDragStore'
import CanvasItemsLayer from './canvasItems/CanvasItemsLayer'
import CanvasItemZOrderMenu from './canvasItems/CanvasItemZOrderMenu'
import SelectionBlurOverlay from './canvasItems/SelectionBlurOverlay'
import { useCanvasFileHandlers } from './canvasItems/useCanvasFileHandlers'
import { useCanvasLockStore } from './canvasLock/canvasLockStore'
import CanvasLockFlattenLayer from './canvasLock/CanvasLockFlattenLayer'
import { useCanvasLockFlatten } from './canvasLock/useCanvasLockFlatten'
import { useCanvasLockFlattenStore } from './canvasLock/canvasLockFlattenStore'
import { shouldFlattenCanvas } from './canvasLock/flattenVisibility'
import { useCanvasWorkspaceStore } from './spaces/canvasWorkspaceStore'
import SpaceBackPill, { SPACE_BACK_PILL_MOTION, SPACE_BACK_PILL_PHONE_CLASS } from './components/SpaceBackPill'
import CutlineMenu from './components/CutlineMenu'
import { NEWS_POSTS } from './content/news'
import type { Notification, NotificationTab, NewsTab } from './types'
import { meshBlobVisibilities } from './theme/paletteGenerator'
import { useThemeCssVars } from './theme/useThemeCssVars'
import { useThemeStore } from './theme/themeStore'
import { useEffectiveMode } from './theme/useEffectiveMode'
import { useProfileStore } from './profile/profileStore'
import { profileToTopBarUser } from './profile/profileUtils'
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CANVAS_MAX_SCALE,
  CANVAS_ZOOM_EDGE_PADDING,
  CANVAS_ZOOM_MIN_EDGE_PADDING,
} from './drawing/canvasDimensions'
import { CANVAS_WHEEL_ZOOM_STEP } from './canvas/canvasCamera'
import { useCanvasCursorWheelZoom } from './canvas/useCanvasCursorWheelZoom'
import { useCanvasViewport } from './canvas/useCanvasViewport'
import { useCanvasZoomEdgeEase } from './canvas/useCanvasZoomEdgeEase'
import { useCanvasPanBounce } from './canvas/useCanvasPanBounce'
import { useCanvasCompositorWarmup } from './canvas/useCanvasCompositorWarmup'
import CanvasSwapVeil from './canvas/CanvasSwapVeil'
import { blurStrayTextFocus } from './platform/textFocus'
import { useLayoutProfile } from './hooks/useLayoutProfile'
import { useShortcutUiStore } from './shortcuts/shortcutUiStore'

const meshBlobMotion = [
  {
    period: 14,
    size: 1600,
    path: [
      [8, 12],
      [32, 28],
      [22, 48],
      [8, 12],
    ],
  },
  {
    period: 18,
    size: 1700,
    path: [
      [88, 10],
      [72, 38],
      [92, 55],
      [88, 10],
    ],
  },
  {
    period: 22,
    size: 1800,
    path: [
      [48, 45],
      [62, 58],
      [38, 52],
      [48, 45],
    ],
  },
  {
    period: 26,
    size: 1650,
    path: [
      [12, 82],
      [28, 68],
      [18, 90],
      [12, 82],
    ],
  },
  {
    period: 30,
    size: 1750,
    path: [
      [85, 78],
      [70, 88],
      [92, 65],
      [85, 78],
    ],
  },
] as const

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
  const { onPanning, onPanningStop } = usePanMotionHandler()
  useCanvasNavigationTracking()
  const canvasSelectionPointer = useCanvasSelectionPointer()
  const palette = useThemeStore((s) => s.palette)
  const themeModeStore = useThemeStore((s) => s.mode)
  const effectiveMode = useEffectiveMode(themeModeStore)
  const { generated } = useThemeCssVars()
  useThemeChangeFeedback(effectiveMode, themeModeStore)
  const meshColors = generated.meshColors
  const meshBlobVisibility = meshBlobVisibilities(palette.blobDepth)
  const meshLayerOpacity = effectiveMode === 'light' ? 0.92 : 0.88

  const transformRef = useRef<ReactZoomPanPinchContentRef | null>(null)
  const { viewportRef, viewportSize, minScale, onTransformInit, onHydrated } =
    useCanvasViewport(transformRef)
  useStudyHubCanvasPanCoordination()
  const trackpadPanLockActive = useCanvasNavigationStore((s) => s.trackpadPanLockActive)
  const panExcluded = useMemo(
    () => canvasPanExcludedClasses(trackpadPanLockActive),
    [trackpadPanLockActive],
  )
  const zoomEdgeEase = useCanvasZoomEdgeEase(minScale)
  const panBounce = useCanvasPanBounce()
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const [canvasMount, setCanvasMount] = useState<HTMLDivElement | null>(null)
  const [appHydrated, setAppHydrated] = useState(false)
  const [penDown, setPenDown] = useState(false)
  const penMenu = usePenToolMenu(transformRef)
  useDrawing(canvasRef, transformRef, setPenDown, penMenu.bridgeRef, canvasMount)
  useTouchUndoRedoGestures(penMenu.bridgeRef)

  const {
    imageInputRef,
    onImageInputChange,
    openImagePicker,
    spawnStickyAtViewportCenter,
    spawnTextAtViewportCenter,
    spawnSpaceAtViewportCenter,
    spawnStudyHubAtViewportCenter,
  } = useCanvasFileHandlers(transformRef, viewportRef, canvasRef)

  const isInsideSpace = useCanvasWorkspaceStore((s) => s.activeCanvasId !== 'main')
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

  useCanvasCompositorWarmup(canvasRef, appHydrated && canvasMount !== null)

  const handleExitSpace = () => {
    if (useCanvasWorkspaceStore.getState().canvasSwapBusy) return
    playSound('spaceExit')
    useCanvasWorkspaceStore
      .getState()
      .exitSpace(transformRef.current, canvasRef.current)
  }

  const itemDragActive = useCanvasItemDragStore((s) => s.activeItemId !== null)
  const toolPaletteOpen = useShortcutUiStore((s) => s.toolPaletteOpen)

  const isPenDown =
    penDown || penMenu.state.phase !== 'idle' || itemDragActive
  const canvasGestureLocked = isPenDown || toolPaletteOpen
  useCanvasCursorWheelZoom({
    transformRef,
    viewportRef,
    panExcluded,
    onZoom: zoomEdgeEase.onZoom,
    onZoomStop: zoomEdgeEase.onZoomStop,
    disabled: isPenDown,
    step: CANVAS_WHEEL_ZOOM_STEP,
  })
  const isCanvasLocked = useCanvasLockStore((s) => s.isLocked)
  const flattenReady = useCanvasLockFlattenStore((s) => s.ready)
  const lockFlattenActive = shouldFlattenCanvas(isCanvasLocked)
  const hideLiveMesh = lockFlattenActive && flattenReady
  const lockCanvas = useCanvasLockStore((s) => s.lockCanvas)
  const requestUnlock = useCanvasLockStore((s) => s.requestUnlock)

  useCanvasLockFlatten(canvasRef, isCanvasLocked)

  useEffect(() => {
    void (async () => {
      await useCanvasWorkspaceStore.getState().hydrate()
      useCanvasItemsStore.getState().hydrate()
      useStrokesStore.getState().hydrate()
      useCanvasLockStore.getState().hydrate()
      useSoundStore.getState().hydrate()
      clearHistory()
      onHydrated()
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAppHydrated(true))
      })
      blurStrayTextFocus()
    })()

    const flushWorkspace = () => {
      useCanvasWorkspaceStore.getState().flushPersistWorkspace()
    }
    window.addEventListener('pagehide', flushWorkspace)
    window.addEventListener('beforeunload', flushWorkspace)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushWorkspace()
    })
    return () => {
      window.removeEventListener('pagehide', flushWorkspace)
      window.removeEventListener('beforeunload', flushWorkspace)
    }
  }, [])

  const themeMode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)
  const profile = useProfileStore((s) => s.profile)
  const topBarUser = profileToTopBarUser(profile)

  const [openPanel, setOpenPanel] = useState<OpenPanel>(null)
  const [activeTab, setActiveTab] = useState<NotificationTab>('all')
  const [activeNewsTab, setActiveNewsTab] = useState<NewsTab>('all')
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS)
  const [seenNewsIds, setSeenNewsIds] = useState<Set<string>>(() => new Set())
  const [panelSeenNewsIds, setPanelSeenNewsIds] = useState<Set<string>>(() => new Set())
  const [badgeAckedNotifIds, setBadgeAckedNotifIds] = useState<Set<string>>(() => new Set())
  const prevOpenPanelRef = useRef<OpenPanel>(null)
  const suppressPanelSoundRef = useRef(false)

  function openOnly(panel: OpenPanel) {
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
    if (opts?.silent) suppressPanelSoundRef.current = true
    useShortcutUiStore.getState().dismissPeerChromeOverlays(opts)
    setOpenPanel(null)
  }, [])
  useKeyboardShortcuts(openPanel, closePanel)
  usePanelSounds(openPanel, suppressPanelSoundRef)
  useBackgroundMusic()

  useEffect(() => {
    useShortcutUiStore.getState().registerAppPanels({ close: closePanel })
    return () => useShortcutUiStore.getState().registerAppPanels(null)
  }, [closePanel])

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
    blurStrayTextFocus()
    const t = window.setTimeout(blurStrayTextFocus, 0)
    return () => window.clearTimeout(t)
  }, [])

  const unreadCount = notifications.filter(
    (n) => n.isUnread && !badgeAckedNotifIds.has(n.id),
  ).length
  const newsCount = NEWS_POSTS.filter((p) => p.isNew && !seenNewsIds.has(p.id)).length

  return (
    <div
      className="cutline-app-shell"
      data-ready={appHydrated || undefined}
    >
      <div ref={viewportRef} className="cutline-canvas-viewport">
        <div
          ref={panBounce.bounceRef}
          style={{ width: '100%', height: '100%' }}
        >
          <TransformWrapper
            ref={transformRef}
            disabled={canvasGestureLocked}
            initialScale={minScale}
            minScale={Math.max(minScale - CANVAS_ZOOM_MIN_EDGE_PADDING, 0.05)}
            maxScale={CANVAS_MAX_SCALE + CANVAS_ZOOM_EDGE_PADDING}
            limitToBounds
            disablePadding
            centerZoomedOut={false}
            onInit={onTransformInit}
            onPanning={(ref) => {
              onPanning(ref)
              panBounce.onPanning(ref)
              useCanvasWorkspaceStore.getState().syncMainCamera(ref)
            }}
            onPanningStop={(ref) => {
              onPanningStop(ref)
              panBounce.onPanningStop()
              useCanvasWorkspaceStore.getState().syncMainCamera(ref)
            }}
            onZoom={zoomEdgeEase.onZoom}
            onPinch={zoomEdgeEase.onPinch}
            onZoomStop={zoomEdgeEase.onZoomStop}
            onPinchStop={zoomEdgeEase.onZoomStop}
            wheel={{
              step: CANVAS_WHEEL_ZOOM_STEP,
              wheelDisabled: true,
              touchPadDisabled: true,
              activationKeys: (keys) =>
                keys.includes('Control') || keys.includes('Meta'),
            }}
            trackPadPanning={{
              disabled: canvasGestureLocked,
              excluded: panExcluded,
            }}
            panning={{
              velocityDisabled: false,
              disabled: canvasGestureLocked,
              excluded: panExcluded,
            }}
            pinch={{
              disabled: canvasGestureLocked,
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
              contentStyle={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
            >
              <div
                ref={(node) => {
                  canvasRef.current = node
                  setCanvasMount(node)
                }}
                className="cutline-draw-target draw-target cutline-canvas-bg"
                onPointerDown={canvasSelectionPointer.onPointerDown}
                onPointerMove={canvasSelectionPointer.onPointerMove}
                onPointerUp={canvasSelectionPointer.onPointerUp}
                onPointerCancel={canvasSelectionPointer.onPointerCancel}
                style={{
                  width: CANVAS_WIDTH,
                  height: CANVAS_HEIGHT,
                  position: 'relative',
                  opacity: canvasFadeOpacity,
                  transition: canvasSwapBusy ? swapTransition : undefined,
                  pointerEvents: canvasSwapBusy ? 'none' : undefined,
                }}
              >
                {meshColors.map((color, index) => {
                  const visibility = meshBlobVisibility[index] ?? 0
                  if (visibility <= 0 || hideLiveMesh) return null

                  return (
                    <div
                      key={index}
                      data-mesh-blob
                      aria-hidden
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `radial-gradient(circle, ${color} 0%, transparent 62%)`,
                        opacity: meshLayerOpacity * visibility,
                        backgroundSize: `${meshBlobMotion[index].size}px ${meshBlobMotion[index].size}px`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: `${meshBlobMotion[index].path[0][0]}% ${meshBlobMotion[index].path[0][1]}%`,
                        pointerEvents: 'none',
                      }}
                    />
                  )
                })}
                <CanvasLockFlattenLayer />
                <CanvasItemsLayer plane="below" transformRef={transformRef} />
                <DrawingLayer />
                <CanvasItemsLayer plane="above" transformRef={transformRef} />
                <CanvasItemsLayer plane="annotation" transformRef={transformRef} />
                <SelectionBlurOverlay />
              </div>
            </TransformComponent>
          </TransformWrapper>
        </div>

        <ThemeChangePulse effectiveMode={effectiveMode} />
      </div>

      {canvasSwapBusy && (
        <CanvasSwapVeil
          opacity={canvasVeilOpacity}
          transition={swapTransition}
        />
      )}

      <MotionIndicator />
      <TrailingVignette />
      <ActionToast />

      <TopBar
        user={topBarUser}
        unreadCount={unreadCount}
        cutlineMenuOpen={openPanel === 'cutline'}
        phoneMenuOpen={openPanel !== null}
        transformRef={transformRef}
        onCutlineClick={() => openOnly('cutline')}
        newsCount={newsCount}
        onNewsClick={() => openOnly('news')}
        onNotificationClick={() => openOnly('notifications')}
        onProfileClick={() => openOnly('profile')}
      />

      <PenFab />

      <PenToolPillMenu state={penMenu.state} />
      <CanvasItemZOrderMenu />

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
            mode={themeMode}
            onModeChange={setMode}
            isCanvasLocked={isCanvasLocked}
            showCanvasLock={!isInsideSpace}
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
            onManageBilling={() => console.log('manage billing')}
            onChangePlan={() => console.log('change plan')}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default App

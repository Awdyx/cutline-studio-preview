import { useEffect, useRef, useState } from 'react'
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchContentRef,
} from 'react-zoom-pan-pinch'
import DrawingLayer from './drawing/DrawingLayer'
import { useDrawing } from './drawing/useDrawing'
import { usePenToolMenu } from './drawing/usePenToolMenu'
import PenToolPillMenu from './components/PenToolPillMenu'
import { AnimatePresence } from 'framer-motion'
import MotionIndicator from './MotionIndicator'
import TrailingVignette from './TrailingVignette'
import { usePanMotionHandler } from './usePanMotionHandler'
import { CANVAS_PAN_EXCLUDED } from './canvas/canvasNavigationStore'
import { useCanvasNavigationTracking } from './canvas/useCanvasNavigationTracking'
import { useDeferredCanvasTap } from './canvas/useDeferredCanvasTap'
import TopBar from './components/TopBar'
import NotificationsPanel from './components/NotificationsPanel'
import ProfilePanel from './components/ProfilePanel'
import PlusFab from './components/PlusFab'
import ToolPalette from './components/ToolPalette'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useBackgroundMusic } from './hooks/useBackgroundMusic'
import { usePanelSounds } from './hooks/usePanelSounds'
import { useThemeChangeFeedback } from './hooks/useThemeChangeFeedback'
import ThemeAmbientPulse from './components/ThemeAmbientPulse'
import { useSoundStore } from './sound/soundStore'
import { playSound } from './sound/playSound'
import ActionToast from './components/ActionToast'
import { clearHistory } from './canvasHistory/canvasHistory'
import { useStrokesStore } from './drawing/strokesStore'
import { useCanvasItemsStore } from './canvasItems/canvasItemsStore'
import { useCanvasItemDragStore } from './canvasItems/canvasItemDragStore'
import CanvasItemsLayer from './canvasItems/CanvasItemsLayer'
import CanvasItemZOrderMenu from './canvasItems/CanvasItemZOrderMenu'
import SelectionBlurOverlay from './canvasItems/SelectionBlurOverlay'
import { useCanvasFileHandlers } from './canvasItems/useCanvasFileHandlers'
import { useCanvasLockStore } from './canvasLock/canvasLockStore'
import { useCanvasWorkspaceStore } from './spaces/canvasWorkspaceStore'
import SpaceBackPill from './components/SpaceBackPill'
import SpaceTransitionOverlay from './components/SpaceTransitionOverlay'
import CutlineMenu from './components/CutlineMenu'
import WhatsNewPanel from './components/WhatsNewPanel'
import UnlockAnnotationsModal from './components/UnlockAnnotationsModal'
import type { Notification, NotificationTab } from './types'
import { meshBlobVisibilities } from './theme/paletteGenerator'
import { useThemeCssVars } from './theme/useThemeCssVars'
import { useThemeStore } from './theme/themeStore'
import { useEffectiveMode } from './theme/useEffectiveMode'
import { useProfileStore } from './profile/profileStore'
import { profileToTopBarUser } from './profile/profileUtils'
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  getCanvasMinScale,
} from './drawing/canvasDimensions'
import { prefersSolidCompositorLayers } from './platform/compositor'

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

const meshKeyframesCss = meshBlobMotion
  .map(
    (blob, index) => `
@keyframes meshBlob${index} {
  0%, 100% { background-position: ${blob.path[0][0]}% ${blob.path[0][1]}%; }
  33% { background-position: ${blob.path[1][0]}% ${blob.path[1][1]}%; }
  66% { background-position: ${blob.path[2][0]}% ${blob.path[2][1]}%; }
}`,
  )
  .join('\n')


const placeholderNotifications: Notification[] = [
  {
    id: '1',
    avatar: { initial: 'S', color: '#7c5cbf' },
    message: 'Sofia commented on your HU canvas',
    timestamp: '2h ago',
    isUnread: true,
    type: 'mention',
  },
  {
    id: '2',
    avatar: { initial: 'M', color: '#3a86c8' },
    message: 'New question added to CE Lecture 4',
    timestamp: '5h ago',
    isUnread: true,
    type: 'all',
  },
  {
    id: '3',
    avatar: { initial: 'T', color: '#3ecf6e' },
    message: 'Tom shared "Biochem Finals" with you',
    timestamp: '1d ago',
    isUnread: false,
    type: 'all',
  },
]

type OpenPanel =
  | 'notifications'
  | 'profile'
  | 'cutline'
  | 'whats-new'
  | null

function App() {
  const [minScale, setMinScale] = useState(getCanvasMinScale)
  const onPanning = usePanMotionHandler()
  useCanvasNavigationTracking()
  const clearCanvasSelectionTap = useDeferredCanvasTap(() => {
    useCanvasItemsStore.getState().clearSelection()
  })
  const palette = useThemeStore((s) => s.palette)
  const themeModeStore = useThemeStore((s) => s.mode)
  const effectiveMode = useEffectiveMode(themeModeStore)
  const { generated } = useThemeCssVars()
  const themePulse = useThemeChangeFeedback(effectiveMode)
  const meshColors = generated.meshColors
  const meshBlobVisibility = meshBlobVisibilities(palette.blobDepth)
  const meshLayerOpacity = effectiveMode === 'light' ? 0.92 : 0.88
  const pauseMeshMotion = prefersSolidCompositorLayers()

  const transformRef = useRef<ReactZoomPanPinchContentRef | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const [canvasMount, setCanvasMount] = useState<HTMLDivElement | null>(null)
  const [penDown, setPenDown] = useState(false)
  const penMenu = usePenToolMenu(transformRef)
  useDrawing(canvasRef, transformRef, setPenDown, penMenu.bridgeRef, canvasMount)

  const {
    imageInputRef,
    onImageInputChange,
    openImagePicker,
    spawnStickyAtViewportCenter,
    spawnTextAtViewportCenter,
    spawnSpaceAtViewportCenter,
  } = useCanvasFileHandlers(transformRef, canvasRef)

  const isInsideSpace = useCanvasWorkspaceStore((s) => s.activeCanvasId !== 'main')
  const spaceTransitionPhase = useCanvasWorkspaceStore((s) => s.transition.phase)
  const canvasFaded =
    spaceTransitionPhase === 'entering' || spaceTransitionPhase === 'exiting'

  const handleExitSpace = () => {
    const workspace = useCanvasWorkspaceStore.getState()
    playSound('spaceExit')
    void workspace
      .captureExitSnapshot(transformRef.current, canvasRef.current)
      .then(() => {
        workspace.beginExitSpace(transformRef.current)
        window.setTimeout(() => {
          workspace.completeExitSpace(transformRef.current)
        }, 280)
      })
  }

  const itemZMenuOpen = useCanvasItemsStore((s) => s.zMenu !== null)
  const itemDragActive = useCanvasItemDragStore((s) => s.activeItemId !== null)

  const isPenDown =
    penDown || penMenu.state.phase !== 'idle' || itemZMenuOpen || itemDragActive
  const isCanvasLocked = useCanvasLockStore((s) => s.isLocked)
  const unlockModalOpen = useCanvasLockStore((s) => s.unlockModalOpen)
  const lockCanvas = useCanvasLockStore((s) => s.lockCanvas)
  const requestUnlock = useCanvasLockStore((s) => s.requestUnlock)
  const cancelUnlock = useCanvasLockStore((s) => s.cancelUnlock)
  const keepAnnotationsAndUnlock = useCanvasLockStore((s) => s.keepAnnotationsAndUnlock)
  const discardAnnotationsAndUnlock = useCanvasLockStore(
    (s) => s.discardAnnotationsAndUnlock,
  )

  useEffect(() => {
    useCanvasWorkspaceStore.getState().hydrate()
    useCanvasItemsStore.getState().hydrate()
    useStrokesStore.getState().hydrate()
    useCanvasLockStore.getState().hydrate()
    useSoundStore.getState().hydrate()
    clearHistory()
    requestAnimationFrame(() => {
      useCanvasWorkspaceStore
        .getState()
        .applyCameraForActiveCanvas(transformRef.current)
    })
  }, [])

  const themeMode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)
  const profile = useProfileStore((s) => s.profile)
  const topBarUser = profileToTopBarUser(profile)

  const [openPanel, setOpenPanel] = useState<OpenPanel>(null)
  const [activeTab, setActiveTab] = useState<NotificationTab>('all')

  function openOnly(panel: OpenPanel) {
    setOpenPanel((current) => (current === panel ? null : panel))
  }

  const closePanel = () => setOpenPanel(null)
  useKeyboardShortcuts(unlockModalOpen, openPanel, cancelUnlock, closePanel)
  usePanelSounds(openPanel, unlockModalOpen)
  useBackgroundMusic()

  useEffect(() => {
    const handleResize = () => setMinScale(getCanvasMinScale())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const unreadCount = placeholderNotifications.filter((n) => n.isUnread).length

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <MotionIndicator />
      <TrailingVignette />
      <ThemeAmbientPulse pulse={themePulse} />
      <ActionToast />

      <TopBar
        user={topBarUser}
        unreadCount={unreadCount}
        cutlineMenuOpen={openPanel === 'cutline'}
        transformRef={transformRef}
        onCutlineClick={() => openOnly('cutline')}
        onNotificationClick={() => openOnly('notifications')}
        onProfileClick={() => openOnly('profile')}
      />

      <ToolPalette />

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
        onStudyAction={(action) => console.log('study action', action)}
      />

      <SpaceTransitionOverlay />
      {isInsideSpace && <SpaceBackPill onExit={handleExitSpace} />}

      <AnimatePresence>
        {openPanel === 'cutline' && (
          <CutlineMenu
            key="cutline"
            isOpen
            onClose={() => setOpenPanel(null)}
            mode={themeMode}
            onModeChange={setMode}
            onNavigate={(dest) => {
              if (dest === 'whats-new') setOpenPanel('whats-new')
              else console.log('cutline navigate', dest)
            }}
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
        {openPanel === 'whats-new' && (
          <WhatsNewPanel key="whats-new" isOpen onClose={closePanel} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {openPanel === 'notifications' && (
          <NotificationsPanel
            key="notifications"
            isOpen
            onClose={() => setOpenPanel(null)}
            notifications={placeholderNotifications}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onMarkAllRead={() => console.log('mark all read')}
            onNotificationClick={(id) => console.log('notification clicked', id)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {unlockModalOpen && (
          <UnlockAnnotationsModal
            key="unlock-annotations"
            isOpen
            onKeep={keepAnnotationsAndUnlock}
            onDiscard={discardAnnotationsAndUnlock}
            onCancel={cancelUnlock}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {openPanel === 'profile' && (
          <ProfilePanel
            key="profile"
            isOpen
            onClose={() => setOpenPanel(null)}
            user={profile}
            onNavigate={(dest) => {
              if (dest === 'help') console.log('help & support')
            }}
            onSignOut={() => console.log('sign out')}
            onManageBilling={() => console.log('manage billing')}
            onChangePlan={() => console.log('change plan')}
          />
        )}
      </AnimatePresence>

      <TransformWrapper
        ref={transformRef}
        initialScale={1}
        minScale={minScale}
        maxScale={4}
        limitToBounds
        disablePadding
        centerZoomedOut={false}
        onInit={(ref) => {
          useCanvasWorkspaceStore
            .getState()
            .applyCameraForActiveCanvas(ref)
        }}
        onPanning={(ref) => {
          onPanning(ref)
          useCanvasWorkspaceStore.getState().syncMainCamera(ref)
        }}
        wheel={{
          step: 0.02,
          activationKeys: (keys) =>
            keys.includes('Control') || keys.includes('Meta'),
        }}
        trackPadPanning={{
          disabled: false,
          excluded: [...CANVAS_PAN_EXCLUDED],
        }}
        panning={{
          velocityDisabled: false,
          disabled: isPenDown,
          excluded: [...CANVAS_PAN_EXCLUDED],
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
            width: '100%',
            height: '100%',
            touchAction: 'none',
          }}
          contentStyle={{ willChange: 'transform' }}
        >
          <div
            ref={(node) => {
              canvasRef.current = node
              setCanvasMount(node)
            }}
            className="cutline-draw-target draw-target cutline-canvas-bg"
            onPointerDown={(e) => {
              if (e.target !== e.currentTarget) return
              clearCanvasSelectionTap.onPointerDown(e)
            }}
            onPointerMove={clearCanvasSelectionTap.onPointerMove}
            onPointerUp={clearCanvasSelectionTap.onPointerUp}
            onPointerCancel={clearCanvasSelectionTap.onPointerCancel}
            style={{
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              position: 'relative',
              transition: 'opacity 280ms ease-out',
              opacity: canvasFaded ? 0 : 1,
            }}
          >
            <style>{meshKeyframesCss}</style>
            {meshColors.map((color, index) => {
              const visibility = meshBlobVisibility[index] ?? 0
              if (visibility <= 0) return null

              return (
                <div
                  key={index}
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `radial-gradient(circle, ${color} 0%, transparent 62%)`,
                    opacity: meshLayerOpacity * visibility,
                    backgroundSize: `${meshBlobMotion[index].size}px ${meshBlobMotion[index].size}px`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: `${meshBlobMotion[index].path[0][0]}% ${meshBlobMotion[index].path[0][1]}%`,
                    animation: pauseMeshMotion
                      ? 'none'
                      : `meshBlob${index} ${meshBlobMotion[index].period}s ease-in-out infinite`,
                    willChange: pauseMeshMotion ? undefined : 'background-position',
                    pointerEvents: 'none',
                  }}
                />
              )
            })}
            <CanvasItemsLayer plane="below" transformRef={transformRef} />
            <DrawingLayer />
            <CanvasItemsLayer plane="above" transformRef={transformRef} />
            <CanvasItemsLayer plane="annotation" transformRef={transformRef} />
            <SelectionBlurOverlay />
          </div>
        </TransformComponent>
      </TransformWrapper>
    </div>
  )
}

export default App

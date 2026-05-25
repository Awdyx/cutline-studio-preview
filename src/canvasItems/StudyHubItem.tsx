import { memo, useRef, useState, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { X } from 'lucide-react'
import { animateCameraToTarget } from '../canvas/canvasCamera'
import StudyHubPanel from '../components/study/StudyHubPanel'
import StudyHubPracticePicker, {
  DEFAULT_STUDY_PRACTICE,
} from '../components/study/StudyHubPracticePicker'
import { STUDY_SUBJECTS, STUDY_SUBJECT_CATALOG } from '../components/study/studyHubData'
import { playSubmenuTap } from '../sound/submenuSound'
import {
  CHROME_PRESERVE_CASE_CLASS,
  card,
  chromeFrostedMenuStyle,
  font,
} from '../styles/tokens'
import { useCanvasItemDragStore } from './canvasItemDragStore'
import { useCanvasItemResizeStore } from './canvasItemResizeStore'
import { useCanvasItemsStore } from './canvasItemsStore'
import CanvasItemShell from './CanvasItemShell'
import { useCanvasItemScrollCapture } from './useCanvasItemScrollCapture'
import { studyHubContentScaleForSize } from './studyHubSpawnScale'
import type { StudyHubCanvasItem } from './types'
import { STUDY_HUB_HEIGHT, STUDY_HUB_WIDTH } from './types'

const MemoStudyHubPanel = memo(StudyHubPanel)

function StudyHubItem({
  item,
  transformRef,
  onItemResizeStateChange,
}: {
  item: StudyHubCanvasItem
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  onItemResizeStateChange?: (resizing: boolean) => void
}) {
  const catalog = STUDY_SUBJECT_CATALOG[item.subjectId]
  const SubjectIcon = STUDY_SUBJECTS.find((s) => s.id === item.subjectId)?.icon
  const scrollRef = useRef<HTMLDivElement>(null)
  const [practice, setPractice] = useState(DEFAULT_STUDY_PRACTICE)
  const isResizing = useCanvasItemResizeStore((s) => s.activeItemId === item.id)
  const isDragging = useCanvasItemDragStore((s) => s.activeItemId === item.id)
  const snapBackNonce = useCanvasItemResizeStore((s) =>
    s.snapBackItemId === item.id ? s.snapBackNonce : 0,
  )
  const perfDrag = isDragging || isResizing
  const showMenuDismiss = useCanvasItemsStore(
    (s) => s.zMenuSuppressedItemId === item.id && s.menuFocusReturnCamera != null,
  )
  useCanvasItemScrollCapture(scrollRef)
  const contentScale = studyHubContentScaleForSize(item.width)

  function handleDismissMenuFocus(e: React.MouseEvent | React.PointerEvent) {
    e.stopPropagation()
    e.preventDefault()
    playSubmenuTap()
    const returnCamera = useCanvasItemsStore.getState().takeMenuFocusReturnCamera()
    if (returnCamera) {
      animateCameraToTarget(transformRef.current, returnCamera, { curved: true })
    }
  }

  return (
    <CanvasItemShell
      item={item}
      transformRef={transformRef}
      onItemResizeStateChange={onItemResizeStateChange}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: card.radius,
          overflow: 'hidden',
          contain: perfDrag ? 'layout style paint' : undefined,
        }}
      >
        <div
          key={snapBackNonce || undefined}
          className={snapBackNonce ? 'study-hub-resize-snap-pulse' : undefined}
          style={{
            position: 'absolute',
            inset: 0,
            transformOrigin: 'center center',
            borderRadius: card.radius,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: STUDY_HUB_WIDTH,
              height: STUDY_HUB_HEIGHT,
              transform: `translate(-50%, -50%) scale(${contentScale})`,
              transformOrigin: 'center center',
              willChange: perfDrag ? 'transform' : undefined,
            }}
          >
            <div
              className={`study-hub-widget theme-surface plus-fab-menu-glass ${CHROME_PRESERVE_CASE_CLASS}${perfDrag ? ' study-hub-widget--perf-drag' : ''}`}
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                ...chromeFrostedMenuStyle,
                background: 'var(--study-hub-surface-bg, var(--glass-bg))',
                fontFamily: font.family,
                color: font.colorPrimary,
                overflow: 'hidden',
              }}
            >
              {showMenuDismiss && (
                <button
                  type="button"
                  className="study-hub-menu-dismiss"
                  aria-label="Return to previous canvas view"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={handleDismissMenuFocus}
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    zIndex: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    padding: 0,
                    border: 'none',
                    borderRadius: 999,
                    background: 'var(--glass-bg)',
                    boxShadow: 'var(--glass-shadow)',
                    color: 'var(--ui-text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <X size={14} strokeWidth={2} />
                </button>
              )}
              <header
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '18px 22px 14px',
                  flexShrink: 0,
                }}
              >
                {SubjectIcon && (
                  <SubjectIcon
                    size={20}
                    strokeWidth={1.8}
                    color={font.colorMuted}
                    style={{ flexShrink: 0 }}
                  />
                )}
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      color: font.colorMuted,
                    }}
                  >
                    {catalog.paperCode}
                  </p>
                  <h2
                    style={{
                      margin: '2px 0 0',
                      fontSize: 18,
                      fontWeight: 600,
                      lineHeight: 1.25,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {catalog.fullName}
                  </h2>
                </div>
              </header>

              <StudyHubPracticePicker value={practice} onChange={setPractice} />

              <div
                ref={scrollRef}
                className="study-hub-scroll"
                style={{
                  flex: 1,
                  overflowY: perfDrag ? 'hidden' : 'auto',
                  padding: '10px 22px 22px',
                  minHeight: 0,
                  touchAction: 'pan-y',
                  overscrollBehavior: 'contain',
                  pointerEvents: perfDrag ? 'none' : undefined,
                }}
              >
                <MemoStudyHubPanel subjectId={item.subjectId} practice={practice} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </CanvasItemShell>
  )
}

export default memo(StudyHubItem, (prev, next) => {
  const a = prev.item
  const b = next.item
  return (
    a === b ||
    (a.id === b.id &&
      a.x === b.x &&
      a.y === b.y &&
      a.width === b.width &&
      a.height === b.height &&
      a.subjectId === b.subjectId)
  )
})

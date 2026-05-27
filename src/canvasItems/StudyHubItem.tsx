import { memo, useRef, useState, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  DEFAULT_STUDY_PRACTICE,
} from '../components/study/StudyHubPracticePicker'
import { useCanvasItemDragStore } from './canvasItemDragStore'
import { useCanvasItemResizeStore } from './canvasItemResizeStore'
import { useCanvasItemsStore } from './canvasItemsStore'
import CanvasItemShell from './CanvasItemShell'
import StudyHubMenuFocusPortal from './StudyHubMenuFocusPortal'
import StudyHubWidget from './StudyHubWidget'
import {
  dismissStudyHubMenuFocus,
} from './studyHubMenuFocus'
import { useCanvasItemScrollCapture } from './useCanvasItemScrollCapture'
import {
  studyHubBorderRadiusCss,
  studyHubContentScaleForSize,
} from './studyHubSpawnScale'
import type { StudyHubCanvasItem } from './types'
import { STUDY_HUB_HEIGHT, STUDY_HUB_WIDTH } from './types'

function StudyHubItem({
  item,
  transformRef,
  onItemResizeStateChange,
}: {
  item: StudyHubCanvasItem
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>
  onItemResizeStateChange?: (resizing: boolean) => void
}) {
  const canvasScrollRef = useRef<HTMLDivElement>(null)
  const focusScrollRef = useRef<HTMLDivElement>(null)
  const [practice, setPractice] = useState(DEFAULT_STUDY_PRACTICE)
  const isResizing = useCanvasItemResizeStore((s) => s.activeItemId === item.id)
  const isDragging = useCanvasItemDragStore((s) => s.activeItemId === item.id)
  const snapBackNonce = useCanvasItemResizeStore((s) =>
    s.snapBackItemId === item.id ? s.snapBackNonce : 0,
  )
  const perfDrag = isDragging || isResizing
  const portalFocused = useCanvasItemsStore(
    (s) => s.menuFocusReturnCamera != null && s.zMenuSuppressedItemId === item.id,
  )
  const menuFocusDismissing = useCanvasItemsStore(
    (s) => s.menuFocusDismissing && s.menuFocusDismissItemId === item.id,
  )
  const showFocusPortal = portalFocused || menuFocusDismissing
  const hideCanvasStudyHubContent = useCanvasItemsStore(
    (s) => s.menuFocusReturnCamera != null && s.zMenuSuppressedItemId === item.id,
  )
  useCanvasItemScrollCapture(canvasScrollRef)

  const contentScale = studyHubContentScaleForSize(item.width)
  const borderRadius = studyHubBorderRadiusCss(item.width)

  function handleDismissMenuFocus(e: React.MouseEvent | React.PointerEvent) {
    e.stopPropagation()
    e.preventDefault()
    dismissStudyHubMenuFocus(transformRef.current)
  }

  return (
    <>
      <CanvasItemShell
        item={item}
        transformRef={transformRef}
        onItemResizeStateChange={onItemResizeStateChange}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius,
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
              borderRadius,
              overflow: 'hidden',
              opacity: hideCanvasStudyHubContent ? 0 : 1,
              pointerEvents: showFocusPortal ? 'none' : undefined,
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
              <StudyHubWidget
                subjectId={item.subjectId}
                practice={practice}
                onPracticeChange={setPractice}
                scrollRef={canvasScrollRef}
                perfDrag={perfDrag}
              />
            </div>
          </div>
        </div>
      </CanvasItemShell>

      <StudyHubMenuFocusPortal
        item={item}
        transformRef={transformRef}
        active={showFocusPortal}
        focused={portalFocused}
        dismissing={menuFocusDismissing}
        practice={practice}
        onPracticeChange={setPractice}
        scrollRef={focusScrollRef}
        onDismiss={handleDismissMenuFocus}
      />
    </>
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
      a.zIndex === b.zIndex &&
      a.width === b.width &&
      a.height === b.height &&
      a.subjectId === b.subjectId)
  )
})

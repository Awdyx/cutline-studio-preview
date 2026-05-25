import { useCallback, useEffect, useRef, type RefObject } from 'react'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { focusItemOnCanvas, readCameraFromRef } from '../canvas/canvasCamera'
import { useCanvasNavigationStore } from '../canvas/canvasNavigationStore'
import { useCanvasEditStore } from '../canvasEdit/canvasEditStore'
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../drawing/canvasDimensions'
import { clientToCanvas } from '../drawing/canvasCoords'
import { putMediaBlob } from '../media/mediaBlobStore'
import { isPhoneLayout } from '../platform/layoutProfile'
import { generateItemId } from './itemId'
import { findStudyHubForSubject, useCanvasItemsStore } from './canvasItemsStore'
import { showMediaImportToast } from './mediaImportFeedback'
import { readCanvasTransformScale } from './studyHubSpawnScale'
import { isAcceptedMediaFile, prepareMediaFromFile } from './mediaUtils'
import { TEXT_HEIGHT, type StudySubjectId } from './types'
import { viewportCenterCanvas, viewportItemSpawnCanvas } from './viewportCenter'
import type { CanvasAddType } from '../components/PlusFab'

function spawnPointCanvas(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  viewportHost: HTMLElement | null | undefined,
  canvasEl: HTMLElement | null | undefined,
): { x: number; y: number } {
  return (
    viewportItemSpawnCanvas(transformRef, viewportHost, canvasEl) ?? {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
    }
  )
}

export function useCanvasFileHandlers(
  transformRef: RefObject<ReactZoomPanPinchContentRef | null>,
  viewportRef: RefObject<HTMLDivElement | null>,
  canvasRef: RefObject<HTMLDivElement | null>,
) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const pendingSpawnCanvasRef = useRef<{ x: number; y: number } | null>(null)

  const placeMediaAt = useCallback(
    async (file: File, canvasX: number, canvasY: number) => {
      const prepared = await prepareMediaFromFile(file)
      if (!prepared.ok) {
        showMediaImportToast(prepared.reason, prepared.fileSize)
        return
      }

      const mediaId = generateItemId()
      const { addImage, addVideo } = useCanvasItemsStore.getState()
      const { media } = prepared
      if (media.kind === 'image') {
        addImage(canvasX, canvasY, mediaId, media.width, media.height)
      } else {
        addVideo(canvasX, canvasY, mediaId, media.width, media.height)
      }

      const saved = await putMediaBlob(mediaId, media.blob)
      if (!saved) {
        useCanvasItemsStore.setState((state) => ({
          items: state.items.filter((item) => item.id !== mediaId),
        }))
        showMediaImportToast('save_failed')
      }
    },
    [],
  )

  const openImagePicker = useCallback(() => {
    pendingSpawnCanvasRef.current = null
    imageInputRef.current?.click()
  }, [])

  const spawnStickyAtViewportCenter = useCallback(() => {
    const center = viewportItemSpawnCanvas(
      transformRef,
      viewportRef.current,
      canvasRef.current,
    )
    if (!center) return
    useCanvasItemsStore.getState().addSticky(center.x, center.y)
  }, [transformRef, viewportRef, canvasRef])

  const spawnTextAtViewportCenter = useCallback(() => {
    const point = viewportItemSpawnCanvas(
      transformRef,
      viewportRef.current,
      canvasRef.current,
      { editableTextHeight: TEXT_HEIGHT },
    )
    if (!point) return
    useCanvasItemsStore.getState().addText(point.x, point.y)
  }, [transformRef, viewportRef, canvasRef])

  const spawnSpaceAtViewportCenter = useCallback(() => {
    const center = viewportItemSpawnCanvas(
      transformRef,
      viewportRef.current,
      canvasRef.current,
    )
    if (!center) return
    useCanvasItemsStore.getState().addSpace(center.x, center.y)
  }, [transformRef, viewportRef, canvasRef])

  const spawnStudyHubAtViewportCenter = useCallback(
    (subjectId: StudySubjectId) => {
      const items = useCanvasItemsStore.getState().items
      const existing = findStudyHubForSubject(items, subjectId)

      if (existing) {
        const returnCamera = readCameraFromRef(transformRef.current)
        useCanvasNavigationStore.getState().suppressBackgroundSelectionClear(600)
        useCanvasItemsStore.getState().selectItem(existing.id, false, {
          allowFrozen: true,
          suppressZMenu: true,
          menuFocusReturnCamera: returnCamera,
        })
        focusItemOnCanvas(transformRef.current, existing, {
          fit: true,
          curved: true,
        })
        return
      }

      if (isPhoneLayout() && !useCanvasEditStore.getState().enabled) {
        useCanvasEditStore.getState().setEnabled(true)
      }

      const center =
        viewportItemSpawnCanvas(
          transformRef,
          viewportRef.current,
          canvasRef.current,
        ) ??
        viewportCenterCanvas(
          transformRef,
          viewportRef.current,
          canvasRef.current,
        ) ?? { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 }
      const spawnScale = readCanvasTransformScale(transformRef)
      useCanvasItemsStore
        .getState()
        .addStudyHub(center.x, center.y, subjectId, spawnScale)
    },
    [transformRef, viewportRef, canvasRef],
  )

  const spawnAtCanvasPoint = useCallback(
    (canvasX: number, canvasY: number, type: CanvasAddType) => {
      if (isPhoneLayout() && !useCanvasEditStore.getState().enabled) {
        useCanvasEditStore.getState().setEnabled(true)
      }

      const store = useCanvasItemsStore.getState()
      if (type === 'sticky') {
        store.addSticky(canvasX, canvasY)
      } else if (type === 'text') {
        store.addText(canvasX, canvasY)
      } else if (type === 'space') {
        store.addSpace(canvasX, canvasY)
      } else if (type === 'image') {
        pendingSpawnCanvasRef.current = { x: canvasX, y: canvasY }
        imageInputRef.current?.click()
      }
    },
    [],
  )

  const onImageInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      const center =
        pendingSpawnCanvasRef.current ??
        spawnPointCanvas(transformRef, viewportRef.current, canvasRef.current)
      pendingSpawnCanvasRef.current = null
      await placeMediaAt(file, center.x, center.y)
    },
    [transformRef, viewportRef, canvasRef, placeMediaAt],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function canvasPointFromClient(clientX: number, clientY: number) {
      return clientToCanvas(clientX, clientY, transformRef, canvas)
    }

    function onDragOver(e: DragEvent) {
      if (!e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }

    async function onDrop(e: DragEvent) {
      const dropped = e.dataTransfer?.files?.[0]
      if (!dropped || !isAcceptedMediaFile(dropped)) return
      e.preventDefault()
      e.stopPropagation()
      const point =
        canvasPointFromClient(e.clientX, e.clientY) ??
        spawnPointCanvas(transformRef, viewportRef.current, canvas)
      await placeMediaAt(dropped, point.x, point.y)
    }

    canvas.addEventListener('dragover', onDragOver)
    canvas.addEventListener('drop', onDrop)
    return () => {
      canvas.removeEventListener('dragover', onDragOver)
      canvas.removeEventListener('drop', onDrop)
    }
  }, [canvasRef, transformRef, viewportRef, placeMediaAt])

  useEffect(() => {
    async function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (!items) return

      for (const entry of items) {
        if (entry.kind !== 'file') continue
        const file = entry.getAsFile()
        if (!file || !isAcceptedMediaFile(file)) continue

        e.preventDefault()
        const center = spawnPointCanvas(
          transformRef,
          viewportRef.current,
          canvasRef.current,
        )
        await placeMediaAt(file, center.x, center.y)
        return
      }
    }

    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [transformRef, viewportRef, canvasRef, placeMediaAt])

  return {
    imageInputRef,
    onImageInputChange,
    openImagePicker,
    spawnStickyAtViewportCenter,
    spawnTextAtViewportCenter,
    spawnSpaceAtViewportCenter,
    spawnStudyHubAtViewportCenter,
    spawnAtCanvasPoint,
  }
}

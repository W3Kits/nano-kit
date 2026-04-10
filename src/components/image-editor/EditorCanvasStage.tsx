import { useEffect, useMemo, useRef, useState } from 'react'
import {
  buildSelectionRect,
  getGuideDeleteBounds,
  getGuideDeleteHit,
  getGuideHit,
  getImageBounds,
  getSelectionHandleCenters,
  getSelectionTarget,
  moveSelection,
  resizeSelection,
  GUIDE_DELETE_SIZE,
  SELECTION_HANDLE_RADIUS,
  type GuideHit,
  type Point,
  type SelectionHandle,
  type SelectionTarget
} from '@/features/image-editor/canvas-interactions'
import { getContainedImageLayout, type DisplayLayout, type Rect } from '@/features/image-editor/geometry'

type ImageSize = { width: number; height: number }
type StageMode = 'slice' | 'edit'
type Interaction =
  | { type: 'guide'; axis: 'row' | 'col'; index: number }
  | { type: 'selection-create'; start: Point }
  | { type: 'selection-move'; start: Point; initialSelection: Rect }
  | { type: 'selection-resize'; handle: SelectionHandle; initialSelection: Rect }
  | null

interface EditorCanvasStageProps {
  imageSrc: string
  mode: StageMode
  rowGuides: number[]
  colGuides: number[]
  selection: Rect | null
  onSelectionChange: (selection: Rect | null) => void
  onRowGuidesChange: (guides: number[]) => void
  onColGuidesChange: (guides: number[]) => void
  onMetricsChange: (metrics: { naturalSize: ImageSize; displayLayout: DisplayLayout }) => void
}

export default function EditorCanvasStage({
  imageSrc,
  mode,
  rowGuides,
  colGuides,
  selection,
  onSelectionChange,
  onRowGuidesChange,
  onColGuidesChange,
  onMetricsChange
}: EditorCanvasStageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const interactionRef = useRef<Interaction>(null)

  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [selectionDraft, setSelectionDraft] = useState<Rect | null>(null)
  const [hoveredGuide, setHoveredGuide] = useState<GuideHit | null>(null)
  const [hoveredGuideDelete, setHoveredGuideDelete] = useState<GuideHit | null>(null)
  const [hoveredSelectionTarget, setHoveredSelectionTarget] = useState<SelectionTarget>(null)

  useEffect(() => {
    const image = new Image()
    image.onload = () => setImageElement(image)
    image.onerror = () => setImageElement(null)
    image.src = imageSrc
  }, [imageSrc])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight
      })
    }

    updateSize()

    const observer = new ResizeObserver(updateSize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const naturalSize = useMemo<ImageSize>(() => {
    if (!imageElement) {
      return { width: 0, height: 0 }
    }
    return {
      width: imageElement.naturalWidth,
      height: imageElement.naturalHeight
    }
  }, [imageElement])

  const displayLayout = useMemo<DisplayLayout>(() => {
    return getContainedImageLayout({
      containerWidth: containerSize.width,
      containerHeight: containerSize.height,
      imageWidth: naturalSize.width,
      imageHeight: naturalSize.height
    })
  }, [containerSize.height, containerSize.width, naturalSize.height, naturalSize.width])

  const imageBounds = useMemo(() => getImageBounds(displayLayout), [displayLayout])
  const currentSelection = selectionDraft ?? selection

  useEffect(() => {
    if (!naturalSize.width || !naturalSize.height || !displayLayout.width || !displayLayout.height) return
    onMetricsChange({ naturalSize, displayLayout })
  }, [displayLayout, naturalSize, onMetricsChange])

  useEffect(() => {
    interactionRef.current = null
    setSelectionDraft(null)
    setHoveredGuide(null)
    setHoveredGuideDelete(null)
    setHoveredSelectionTarget(null)
  }, [imageSrc, mode])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (mode === 'slice') {
      if (hoveredGuideDelete) {
        canvas.style.cursor = 'pointer'
      } else if (hoveredGuide?.axis === 'row') {
        canvas.style.cursor = 'ns-resize'
      } else if (hoveredGuide?.axis === 'col') {
        canvas.style.cursor = 'ew-resize'
      } else {
        canvas.style.cursor = 'default'
      }
      return
    }

    if (hoveredSelectionTarget?.type === 'move') {
      canvas.style.cursor = 'move'
      return
    }

    if (hoveredSelectionTarget?.type === 'handle') {
      canvas.style.cursor = getCursorForHandle(hoveredSelectionTarget.handle)
      return
    }

    canvas.style.cursor = 'crosshair'
  }, [hoveredGuide, hoveredGuideDelete, hoveredSelectionTarget, mode])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const width = Math.max(1, containerSize.width)
    const height = Math.max(1, containerSize.height)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    if (!imageElement || !displayLayout.width || !displayLayout.height) return

    ctx.drawImage(
      imageElement,
      displayLayout.offsetX,
      displayLayout.offsetY,
      displayLayout.width,
      displayLayout.height
    )

    if (mode === 'slice') {
      drawGuides(ctx, {
        layout: displayLayout,
        rowGuides,
        colGuides,
        hoveredGuide,
        hoveredGuideDelete
      })
      return
    }

    drawSelectionMask(ctx, {
      layout: displayLayout,
      selection: currentSelection,
      hoveredSelectionTarget
    })
  }, [
    colGuides,
    containerSize.height,
    containerSize.width,
    currentSelection,
    displayLayout,
    hoveredGuide,
    hoveredGuideDelete,
    hoveredSelectionTarget,
    imageElement,
    mode,
    rowGuides
  ])

  const getPointerPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }
  }

  const isInsideImage = (point: Point) => {
    return point.x >= imageBounds.x &&
      point.x <= imageBounds.x + imageBounds.width &&
      point.y >= imageBounds.y &&
      point.y <= imageBounds.y + imageBounds.height
  }

  const clampToImage = (point: Point): Point => ({
    x: clamp(point.x, imageBounds.x, imageBounds.x + imageBounds.width),
    y: clamp(point.y, imageBounds.y, imageBounds.y + imageBounds.height)
  })

  const getSelectionPreview = (interaction: Exclude<Interaction, null>, point: Point): Rect | null => {
    if (interaction.type === 'guide') {
      return null
    }

    const clampedPoint = clampToImage(point)

    if (interaction.type === 'selection-create') {
      return buildSelectionRect(interaction.start, clampedPoint)
    }

    if (interaction.type === 'selection-move') {
      return moveSelection({
        selection: interaction.initialSelection,
        deltaX: clampedPoint.x - interaction.start.x,
        deltaY: clampedPoint.y - interaction.start.y,
        bounds: imageBounds
      })
    }

    return resizeSelection({
      selection: interaction.initialSelection,
      handle: interaction.handle,
      point: clampedPoint,
      bounds: imageBounds
    })
  }

  const updateHoverState = (point: Point, selectionOverride?: Rect | null) => {
    if (!displayLayout.width || !displayLayout.height) {
      setHoveredGuide(null)
      setHoveredGuideDelete(null)
      setHoveredSelectionTarget(null)
      return
    }

    if (mode === 'slice') {
      const deleteHit = getGuideDeleteHit({
        point,
        layout: displayLayout,
        rowGuides,
        colGuides
      })
      const guideHit = deleteHit ?? getGuideHit({
        point,
        layout: displayLayout,
        rowGuides,
        colGuides
      })
      setHoveredGuideDelete(deleteHit)
      setHoveredGuide(guideHit)
      setHoveredSelectionTarget(null)
      return
    }

    setHoveredGuide(null)
    setHoveredGuideDelete(null)
    setHoveredSelectionTarget(getSelectionTarget({
      point,
      selection: selectionOverride === undefined ? currentSelection : selectionOverride
    }))
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!imageElement || !displayLayout.width || !displayLayout.height) return

    const point = getPointerPoint(event)

    if (mode === 'slice') {
      const deleteHit = getGuideDeleteHit({
        point,
        layout: displayLayout,
        rowGuides,
        colGuides
      })
      if (deleteHit) {
        if (deleteHit.axis === 'row') {
          onRowGuidesChange(rowGuides.filter((_, index) => index !== deleteHit.index))
        } else {
          onColGuidesChange(colGuides.filter((_, index) => index !== deleteHit.index))
        }
        setHoveredGuide(null)
        setHoveredGuideDelete(null)
        return
      }

      const hit = getGuideHit({
        point,
        layout: displayLayout,
        rowGuides,
        colGuides
      })
      if (!hit) {
        updateHoverState(point)
        return
      }

      interactionRef.current = { type: 'guide', axis: hit.axis, index: hit.index }
      setHoveredGuide(hit)
      setHoveredGuideDelete(null)
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }

    if (!isInsideImage(point)) {
      setHoveredSelectionTarget(null)
      return
    }

    const target = getSelectionTarget({
      point,
      selection: currentSelection
    })
    const start = clampToImage(point)

    if (target?.type === 'move' && currentSelection) {
      interactionRef.current = {
        type: 'selection-move',
        start,
        initialSelection: currentSelection
      }
      setSelectionDraft(currentSelection)
      setHoveredSelectionTarget(target)
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }

    if (target?.type === 'handle' && currentSelection) {
      interactionRef.current = {
        type: 'selection-resize',
        handle: target.handle,
        initialSelection: currentSelection
      }
      setSelectionDraft(currentSelection)
      setHoveredSelectionTarget(target)
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }

    interactionRef.current = { type: 'selection-create', start }
    setSelectionDraft({ x: start.x, y: start.y, width: 0, height: 0 })
    setHoveredSelectionTarget(null)
    onSelectionChange(null)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getPointerPoint(event)
    const interaction = interactionRef.current

    if (!interaction) {
      updateHoverState(point)
      return
    }

    if (interaction.type === 'guide') {
      if (interaction.axis === 'row') {
        const nextValue = clamp((point.y - displayLayout.offsetY) / Math.max(displayLayout.height, 1), 0.02, 0.98)
        onRowGuidesChange(
          rowGuides.map((value, index) => index === interaction.index ? nextValue : value)
        )
      } else {
        const nextValue = clamp((point.x - displayLayout.offsetX) / Math.max(displayLayout.width, 1), 0.02, 0.98)
        onColGuidesChange(
          colGuides.map((value, index) => index === interaction.index ? nextValue : value)
        )
      }
      setHoveredGuide({ axis: interaction.axis, index: interaction.index })
      setHoveredGuideDelete(null)
      return
    }

    const nextSelection = getSelectionPreview(interaction, point)
    if (nextSelection) {
      setSelectionDraft(nextSelection)
    }
  }

  const endInteraction = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const interaction = interactionRef.current
    const point = getPointerPoint(event)

    if (!interaction) {
      updateHoverState(point)
      return
    }

    if (interaction.type !== 'guide') {
      const nextSelection = getSelectionPreview(interaction, point)
      const committedSelection = nextSelection && nextSelection.width >= 4 && nextSelection.height >= 4
        ? nextSelection
        : null
      onSelectionChange(committedSelection)
      setSelectionDraft(null)
      setHoveredSelectionTarget(getSelectionTarget({
        point,
        selection: committedSelection
      }))
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    interactionRef.current = null
    if (interaction.type === 'guide') {
      updateHoverState(point)
    }
  }

  const handlePointerLeave = () => {
    if (interactionRef.current) return
    setHoveredGuide(null)
    setHoveredGuideDelete(null)
    setHoveredSelectionTarget(null)
  }

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endInteraction}
        onPointerCancel={endInteraction}
        onPointerLeave={handlePointerLeave}
      />
    </div>
  )
}

function drawGuides(
  ctx: CanvasRenderingContext2D,
  {
    layout,
    rowGuides,
    colGuides,
    hoveredGuide,
    hoveredGuideDelete
  }: {
    layout: DisplayLayout
    rowGuides: number[]
    colGuides: number[]
    hoveredGuide: GuideHit | null
    hoveredGuideDelete: GuideHit | null
  }
) {
  const rowColor = getCssColor('--accent-color', '#d97757')
  const colColor = getCssColor('--link-color', '#4f86f7')

  ctx.save()
  ctx.beginPath()
  ctx.rect(layout.offsetX, layout.offsetY, layout.width, layout.height)
  ctx.clip()

  rowGuides.forEach((guide, index) => {
    const active = hoveredGuide?.axis === 'row' && hoveredGuide.index === index
    const deleteActive = hoveredGuideDelete?.axis === 'row' && hoveredGuideDelete.index === index
    const y = layout.offsetY + guide * layout.height

    ctx.save()
    ctx.strokeStyle = rowColor
    ctx.globalAlpha = active ? 1 : 0.92
    ctx.lineWidth = active ? 3 : 2
    ctx.setLineDash(active ? [] : [8, 6])
    ctx.shadowColor = rowColor
    ctx.shadowBlur = active ? 12 : 0
    ctx.beginPath()
    ctx.moveTo(layout.offsetX, y)
    ctx.lineTo(layout.offsetX + layout.width, y)
    ctx.stroke()
    ctx.restore()

    if (active || deleteActive) {
      drawGuideDeleteHandle(ctx, {
        bounds: getGuideDeleteBounds({ axis: 'row', guide, layout }),
        color: rowColor,
        active: deleteActive
      })
    }
  })

  colGuides.forEach((guide, index) => {
    const active = hoveredGuide?.axis === 'col' && hoveredGuide.index === index
    const deleteActive = hoveredGuideDelete?.axis === 'col' && hoveredGuideDelete.index === index
    const x = layout.offsetX + guide * layout.width

    ctx.save()
    ctx.strokeStyle = colColor
    ctx.globalAlpha = active ? 1 : 0.92
    ctx.lineWidth = active ? 3 : 2
    ctx.setLineDash(active ? [] : [8, 6])
    ctx.shadowColor = colColor
    ctx.shadowBlur = active ? 12 : 0
    ctx.beginPath()
    ctx.moveTo(x, layout.offsetY)
    ctx.lineTo(x, layout.offsetY + layout.height)
    ctx.stroke()
    ctx.restore()

    if (active || deleteActive) {
      drawGuideDeleteHandle(ctx, {
        bounds: getGuideDeleteBounds({ axis: 'col', guide, layout }),
        color: colColor,
        active: deleteActive
      })
    }
  })

  ctx.restore()
}

function drawGuideDeleteHandle(
  ctx: CanvasRenderingContext2D,
  {
    bounds,
    color,
    active
  }: {
    bounds: Rect
    color: string
    active: boolean
  }
) {
  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2
  const radius = GUIDE_DELETE_SIZE / 2

  ctx.save()
  ctx.fillStyle = active ? color : 'rgba(15, 23, 42, 0.88)'
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(centerX - 4, centerY - 4)
  ctx.lineTo(centerX + 4, centerY + 4)
  ctx.moveTo(centerX + 4, centerY - 4)
  ctx.lineTo(centerX - 4, centerY + 4)
  ctx.stroke()
  ctx.restore()
}

function drawSelectionMask(
  ctx: CanvasRenderingContext2D,
  {
    layout,
    selection,
    hoveredSelectionTarget
  }: {
    layout: DisplayLayout
    selection: Rect | null
    hoveredSelectionTarget: SelectionTarget
  }
) {
  const accentColor = getCssColor('--accent-color', '#d97757')

  ctx.save()
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)'
  ctx.beginPath()
  ctx.rect(layout.offsetX, layout.offsetY, layout.width, layout.height)
  if (selection) {
    ctx.rect(selection.x, selection.y, selection.width, selection.height)
  }
  ctx.fill('evenodd')

  if (selection) {
    ctx.strokeStyle = accentColor
    ctx.lineWidth = hoveredSelectionTarget?.type === 'move' ? 3 : 2
    ctx.shadowColor = accentColor
    ctx.shadowBlur = hoveredSelectionTarget ? 12 : 0
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
    ctx.fillRect(selection.x, selection.y, selection.width, selection.height)
    ctx.strokeRect(selection.x, selection.y, selection.width, selection.height)

    const handleCenters = getSelectionHandleCenters(selection)
    for (const [handle, center] of Object.entries(handleCenters) as Array<[SelectionHandle, Point]>) {
      const active = hoveredSelectionTarget?.type === 'handle' && hoveredSelectionTarget.handle === handle
      ctx.beginPath()
      ctx.arc(center.x, center.y, SELECTION_HANDLE_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = active ? accentColor : '#ffffff'
      ctx.fill()
      ctx.lineWidth = active ? 3 : 2
      ctx.strokeStyle = active ? '#ffffff' : accentColor
      ctx.stroke()
    }
  }

  ctx.restore()
}

function getCursorForHandle(handle: SelectionHandle): string {
  if (handle === 'nw' || handle === 'se') {
    return 'nwse-resize'
  }
  return 'nesw-resize'
}

function getCssColor(variableName: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim()
  return value || fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export interface ImageSize {
  width: number
  height: number
}

export interface DisplayLayout {
  width: number
  height: number
  offsetX: number
  offsetY: number
  scale: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface ImageEditRequest {
  originalImage: string
  selectionImage?: string
  selectionRect: Rect
  selectionRectNormalized: Rect
  prompt: string
  resolution: string
  aspectRatio: string
  enableModelSuffix: boolean
}

export function getContainedImageLayout({
  containerWidth,
  containerHeight,
  imageWidth,
  imageHeight
}: {
  containerWidth: number
  containerHeight: number
  imageWidth: number
  imageHeight: number
}): DisplayLayout {
  if (containerWidth <= 0 || containerHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return {
      width: 0,
      height: 0,
      offsetX: 0,
      offsetY: 0,
      scale: 0
    }
  }

  const scale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight)
  const width = imageWidth * scale
  const height = imageHeight * scale
  return {
    width,
    height,
    offsetX: (containerWidth - width) / 2,
    offsetY: (containerHeight - height) / 2,
    scale
  }
}

export function buildImageEditRequest({
  imageDataUrl,
  prompt,
  naturalSize,
  displayLayout,
  selection,
  selectionImageDataUrl,
  resolution,
  aspectRatio,
  enableModelSuffix
}: {
  imageDataUrl: string
  prompt: string
  naturalSize: ImageSize
  displayLayout: DisplayLayout
  selection: Rect
  selectionImageDataUrl?: string
  resolution: string
  aspectRatio: string
  enableModelSuffix: boolean
}): ImageEditRequest {
  const selectionRect = selectionToNaturalRect(selection, displayLayout, naturalSize)

  return {
    originalImage: imageDataUrl,
    selectionImage: selectionImageDataUrl,
    selectionRect,
    selectionRectNormalized: {
      x: selectionRect.x / naturalSize.width,
      y: selectionRect.y / naturalSize.height,
      width: selectionRect.width / naturalSize.width,
      height: selectionRect.height / naturalSize.height
    },
    prompt: prompt.trim(),
    resolution,
    aspectRatio,
    enableModelSuffix
  }
}

export function selectionToNaturalRect(
  selection: Rect,
  displayLayout: DisplayLayout,
  naturalSize: ImageSize
): Rect {
  if (displayLayout.scale <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  const x = clamp((selection.x - displayLayout.offsetX) / displayLayout.scale, 0, naturalSize.width)
  const y = clamp((selection.y - displayLayout.offsetY) / displayLayout.scale, 0, naturalSize.height)
  const maxX = clamp((selection.x + selection.width - displayLayout.offsetX) / displayLayout.scale, 0, naturalSize.width)
  const maxY = clamp((selection.y + selection.height - displayLayout.offsetY) / displayLayout.scale, 0, naturalSize.height)

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(Math.max(0, maxX - x)),
    height: Math.round(Math.max(0, maxY - y))
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

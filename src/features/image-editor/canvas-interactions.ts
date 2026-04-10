import type { DisplayLayout, Rect } from './geometry'

export type Point = { x: number; y: number }
export type GuideAxis = 'row' | 'col'
export type GuideHit = { axis: GuideAxis; index: number }
export type SelectionHandle = 'nw' | 'ne' | 'se' | 'sw'
export type SelectionTarget =
  | { type: 'move' }
  | { type: 'handle'; handle: SelectionHandle }
  | null

export const GUIDE_DELETE_SIZE = 18
export const SELECTION_HANDLE_RADIUS = 7

export function getImageBounds(layout: DisplayLayout): Rect {
  return {
    x: layout.offsetX,
    y: layout.offsetY,
    width: layout.width,
    height: layout.height
  }
}

export function buildSelectionRect(start: Point, current: Point): Rect {
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y)
  }
}

export function getGuideHit({
  point,
  layout,
  rowGuides,
  colGuides,
  threshold = 8
}: {
  point: Point
  layout: DisplayLayout
  rowGuides: number[]
  colGuides: number[]
  threshold?: number
}): GuideHit | null {
  let bestHit: (GuideHit & { distance: number }) | null = null
  const bounds = getImageBounds(layout)

  for (const [index, guide] of rowGuides.entries()) {
    const y = layout.offsetY + guide * layout.height
    const distance = Math.abs(point.y - y)
    if (!isBetween(point.x, bounds.x, bounds.x + bounds.width) || distance > threshold) {
      continue
    }
    if (!bestHit || distance < bestHit.distance) {
      bestHit = { axis: 'row', index, distance }
    }
  }

  for (const [index, guide] of colGuides.entries()) {
    const x = layout.offsetX + guide * layout.width
    const distance = Math.abs(point.x - x)
    if (!isBetween(point.y, bounds.y, bounds.y + bounds.height) || distance > threshold) {
      continue
    }
    if (!bestHit || distance < bestHit.distance) {
      bestHit = { axis: 'col', index, distance }
    }
  }

  if (!bestHit) {
    return null
  }

  return {
    axis: bestHit.axis,
    index: bestHit.index
  }
}

export function getGuideDeleteHit({
  point,
  layout,
  rowGuides,
  colGuides
}: {
  point: Point
  layout: DisplayLayout
  rowGuides: number[]
  colGuides: number[]
}): GuideHit | null {
  let bestHit: (GuideHit & { distance: number }) | null = null

  for (const [index, guide] of rowGuides.entries()) {
    const bounds = getGuideDeleteBounds({ axis: 'row', guide, layout })
    if (!pointInRect(point, bounds)) {
      continue
    }
    const center = getRectCenter(bounds)
    const distance = distanceBetween(point, center)
    if (!bestHit || distance < bestHit.distance) {
      bestHit = { axis: 'row', index, distance }
    }
  }

  for (const [index, guide] of colGuides.entries()) {
    const bounds = getGuideDeleteBounds({ axis: 'col', guide, layout })
    if (!pointInRect(point, bounds)) {
      continue
    }
    const center = getRectCenter(bounds)
    const distance = distanceBetween(point, center)
    if (!bestHit || distance < bestHit.distance) {
      bestHit = { axis: 'col', index, distance }
    }
  }

  if (!bestHit) {
    return null
  }

  return {
    axis: bestHit.axis,
    index: bestHit.index
  }
}

export function getGuideDeleteBounds({
  axis,
  guide,
  layout,
  size = GUIDE_DELETE_SIZE
}: {
  axis: GuideAxis
  guide: number
  layout: DisplayLayout
  size?: number
}): Rect {
  const padding = 8
  if (axis === 'row') {
    const centerX = layout.offsetX + layout.width - padding - size / 2
    const centerY = layout.offsetY + guide * layout.height
    return {
      x: centerX - size / 2,
      y: centerY - size / 2,
      width: size,
      height: size
    }
  }

  const centerX = layout.offsetX + guide * layout.width
  const centerY = layout.offsetY + padding + size / 2
  return {
    x: centerX - size / 2,
    y: centerY - size / 2,
    width: size,
    height: size
  }
}

export function getSelectionTarget({
  point,
  selection,
  handleRadius = SELECTION_HANDLE_RADIUS
}: {
  point: Point
  selection: Rect | null
  handleRadius?: number
}): SelectionTarget {
  if (!selection || selection.width <= 0 || selection.height <= 0) {
    return null
  }

  const handles = getSelectionHandleCenters(selection)
  for (const [handle, center] of Object.entries(handles) as Array<[SelectionHandle, Point]>) {
    if (distanceBetween(point, center) <= handleRadius + 2) {
      return { type: 'handle', handle }
    }
  }

  if (pointInRect(point, selection)) {
    return { type: 'move' }
  }

  return null
}

export function getSelectionHandleCenters(selection: Rect): Record<SelectionHandle, Point> {
  return {
    nw: { x: selection.x, y: selection.y },
    ne: { x: selection.x + selection.width, y: selection.y },
    se: { x: selection.x + selection.width, y: selection.y + selection.height },
    sw: { x: selection.x, y: selection.y + selection.height }
  }
}

export function moveSelection({
  selection,
  deltaX,
  deltaY,
  bounds
}: {
  selection: Rect
  deltaX: number
  deltaY: number
  bounds: Rect
}): Rect {
  const maxX = Math.max(bounds.x, bounds.x + bounds.width - selection.width)
  const maxY = Math.max(bounds.y, bounds.y + bounds.height - selection.height)
  return {
    x: clamp(selection.x + deltaX, bounds.x, maxX),
    y: clamp(selection.y + deltaY, bounds.y, maxY),
    width: selection.width,
    height: selection.height
  }
}

export function resizeSelection({
  selection,
  handle,
  point,
  bounds,
  minSize = 12
}: {
  selection: Rect
  handle: SelectionHandle
  point: Point
  bounds: Rect
  minSize?: number
}): Rect {
  const left = selection.x
  const top = selection.y
  const right = selection.x + selection.width
  const bottom = selection.y + selection.height
  const boundsRight = bounds.x + bounds.width
  const boundsBottom = bounds.y + bounds.height

  if (handle === 'nw') {
    const nextLeft = clamp(point.x, bounds.x, right - minSize)
    const nextTop = clamp(point.y, bounds.y, bottom - minSize)
    return rectFromEdges(nextLeft, nextTop, right, bottom)
  }

  if (handle === 'ne') {
    const nextRight = clamp(point.x, left + minSize, boundsRight)
    const nextTop = clamp(point.y, bounds.y, bottom - minSize)
    return rectFromEdges(left, nextTop, nextRight, bottom)
  }

  if (handle === 'se') {
    const nextRight = clamp(point.x, left + minSize, boundsRight)
    const nextBottom = clamp(point.y, top + minSize, boundsBottom)
    return rectFromEdges(left, top, nextRight, nextBottom)
  }

  const nextLeft = clamp(point.x, bounds.x, right - minSize)
  const nextBottom = clamp(point.y, top + minSize, boundsBottom)
  return rectFromEdges(nextLeft, top, right, nextBottom)
}

function rectFromEdges(left: number, top: number, right: number, bottom: number): Rect {
  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top)
  }
}

function pointInRect(point: Point, rect: Rect): boolean {
  return point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
}

function getRectCenter(rect: Rect): Point {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  }
}

function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function isBetween(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

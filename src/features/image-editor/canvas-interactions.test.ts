import { describe, expect, it } from 'vitest'
import {
  getGuideDeleteHit,
  getGuideHit,
  getSelectionTarget,
  moveSelection,
  resizeSelection
} from './canvas-interactions'
import type { DisplayLayout, Rect } from './geometry'

const layout: DisplayLayout = {
  width: 300,
  height: 200,
  offsetX: 10,
  offsetY: 20,
  scale: 1
}

const imageBounds: Rect = {
  x: layout.offsetX,
  y: layout.offsetY,
  width: layout.width,
  height: layout.height
}

describe('getGuideHit', () => {
  it('returns the nearest guide inside the displayed image area', () => {
    expect(
      getGuideHit({
        point: { x: 150, y: 72 },
        layout,
        rowGuides: [0.25, 0.75],
        colGuides: [0.2, 0.6]
      })
    ).toEqual({ axis: 'row', index: 0 })
  })
})

describe('getGuideDeleteHit', () => {
  it('detects a click on a row guide delete handle', () => {
    expect(
      getGuideDeleteHit({
        point: { x: 294, y: 70 },
        layout,
        rowGuides: [0.25],
        colGuides: []
      })
    ).toEqual({ axis: 'row', index: 0 })
  })
})

describe('getSelectionTarget', () => {
  it('prefers resize handles over move hits', () => {
    expect(
      getSelectionTarget({
        point: { x: 165, y: 145 },
        selection: { x: 50, y: 60, width: 120, height: 90 }
      })
    ).toEqual({ type: 'handle', handle: 'se' })
  })
})

describe('moveSelection', () => {
  it('keeps the moved selection inside the image bounds', () => {
    expect(
      moveSelection({
        selection: { x: 60, y: 70, width: 100, height: 80 },
        deltaX: 200,
        deltaY: 120,
        bounds: imageBounds
      })
    ).toEqual({
      x: 210,
      y: 140,
      width: 100,
      height: 80
    })
  })
})

describe('resizeSelection', () => {
  it('resizes from a corner handle while clamping to bounds', () => {
    expect(
      resizeSelection({
        selection: { x: 60, y: 70, width: 100, height: 80 },
        handle: 'nw',
        point: { x: 0, y: 10 },
        bounds: imageBounds
      })
    ).toEqual({
      x: 10,
      y: 20,
      width: 150,
      height: 130
    })
  })
})

import { describe, expect, it } from 'vitest'
import { buildImageEditRequest, getContainedImageLayout } from './geometry'

describe('getContainedImageLayout', () => {
  it('returns the rendered image box for object-contain content', () => {
    expect(
      getContainedImageLayout({
        containerWidth: 800,
        containerHeight: 600,
        imageWidth: 1200,
        imageHeight: 400
      })
    ).toEqual({
      width: 800,
      height: 266.66666666666663,
      offsetX: 0,
      offsetY: 166.66666666666669,
      scale: 0.6666666666666666
    })
  })
})

describe('buildImageEditRequest', () => {
  it('builds selection coordinates from display-space selection', () => {
    const request = buildImageEditRequest({
      imageDataUrl: 'data:image/png;base64,AAAA',
      prompt: 'remove the logo',
      naturalSize: { width: 1000, height: 500 },
      displayLayout: {
        width: 500,
        height: 250,
        offsetX: 10,
        offsetY: 20,
        scale: 0.5
      },
      selection: {
        x: 110,
        y: 70,
        width: 200,
        height: 100
      },
      resolution: '2K',
      aspectRatio: 'auto',
      enableModelSuffix: true
    })

    expect(request.selectionRect).toEqual({
      x: 200,
      y: 100,
      width: 400,
      height: 200
    })
    expect(request.selectionRectNormalized).toEqual({
      x: 0.2,
      y: 0.2,
      width: 0.4,
      height: 0.4
    })
    expect(request.selectionImage).toBeUndefined()
    expect(request.originalImage).toBe('data:image/png;base64,AAAA')
    expect(request.prompt).toBe('remove the logo')
  })
})

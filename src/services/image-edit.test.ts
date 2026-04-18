import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Provider } from '@/types'

const requestSharedImage = vi.fn()

vi.mock('./shared-image-request', () => ({
  requestSharedImage
}))

const provider: Provider = {
  id: 'p1',
  name: 'Primary',
  type: 'openai',
  host: 'https://example.com',
  key: 'secret',
  textModel: 'gpt-4.1',
  imageModel: 'gpt-image-1',
  capabilities: {
    image: true,
    text: true
  },
  enableModelSuffix: true
}

describe('requestImageEdit', () => {
  afterEach(() => {
    requestSharedImage.mockReset()
  })

  it('uses the shared image request payload with the edit prompt and original image', async () => {
    requestSharedImage.mockResolvedValue({
      images: ['data:image/png;base64,AAAA'],
      text: 'ok'
    })

    const { requestImageEdit } = await import('./image-edit')
    const result = await requestImageEdit(provider, {
      originalImage: 'data:image/png;base64,BBBB',
      selectionRect: { x: 10, y: 20, width: 30, height: 40 },
      selectionRectNormalized: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
      prompt: 'remove the logo',
      resolution: '2K',
      aspectRatio: '16:9',
      enableModelSuffix: true
    })

    expect(result).toBe('data:image/png;base64,AAAA')
    expect(requestSharedImage).toHaveBeenCalledTimes(1)
    expect(requestSharedImage).toHaveBeenCalledWith(provider, {
      prompt: [
        'You are performing localized image editing.',
        'Only modify the selected rectangle and preserve all pixels outside that area as much as possible.',
        'Use the original full image as global context.',
        'Pixel rectangle: x=10, y=20, width=30, height=40.',
        'Normalized rectangle: x=0.1000, y=0.2000, width=0.3000, height=0.4000.',
        'Edit request: remove the logo'
      ].join('\n'),
      images: [
        {
          dataUrl: 'data:image/png;base64,BBBB',
          mimeType: 'image/png',
          base64Data: 'BBBB'
        }
      ],
      resolution: '2K',
      aspectRatio: '16:9',
      enableModelSuffix: true,
      stream: true,
      responseModalities: ['TEXT', 'IMAGE']
    })
  })

  it('throws when the shared image request returns no image data', async () => {
    requestSharedImage.mockResolvedValue({
      images: [],
      text: 'missing image'
    })

    const { requestImageEdit } = await import('./image-edit')

    await expect(requestImageEdit(provider, {
      originalImage: 'data:image/png;base64,BBBB',
      selectionRect: { x: 10, y: 20, width: 30, height: 40 },
      selectionRectNormalized: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
      prompt: 'remove the logo',
      resolution: '2K',
      aspectRatio: 'auto',
      enableModelSuffix: true
    })).rejects.toThrow('未返回图片数据')
  })
})

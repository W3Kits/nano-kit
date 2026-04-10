import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Provider } from '@/types'
import { requestImageEdit } from './image-edit'

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

const geminiProvider: Provider = {
  ...provider,
  id: 'p2',
  type: 'gemini',
  textModel: 'gemini-3-flash',
  imageModel: 'gemini-3-pro-image'
}

describe('requestImageEdit', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('parses OpenAI image edit SSE responses when stream mode is enabled', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body))
      expect(payload.stream).toBe(true)
      expect(payload.messages).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                'You are performing localized image editing.',
                'Only modify the selected rectangle and preserve all pixels outside that area as much as possible.',
                'Use the original full image as global context.',
                'Pixel rectangle: x=10, y=20, width=30, height=40.',
                'Normalized rectangle: x=0.1000, y=0.2000, width=0.3000, height=0.4000.',
                'Edit request: remove the logo'
              ].join('\n')
            },
            {
              type: 'image_url',
              image_url: {
                url: 'data:image/png;base64,BBBB'
              }
            }
          ]
        }
      ])
      expect(payload.contents).toEqual([
        {
          role: 'user',
          parts: [
            {
              text: [
                'You are performing localized image editing.',
                'Only modify the selected rectangle and preserve all pixels outside that area as much as possible.',
                'Use the original full image as global context.',
                'Pixel rectangle: x=10, y=20, width=30, height=40.',
                'Normalized rectangle: x=0.1000, y=0.2000, width=0.3000, height=0.4000.',
                'Edit request: remove the logo'
              ].join('\n')
            },
            {
              inline_data: {
                mime_type: 'image/png',
                data: 'BBBB'
              }
            }
          ]
        }
      ])
      expect(payload.generationConfig).toEqual({
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          imageSize: '2K'
        }
      })

      const body = [
        'data: {"choices":[{"delta":{"content":"![result](data:image/png;base64,AAAA)"}}]}',
        '',
        'data: [DONE]',
        ''
      ].join('\n')

      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream'
        }
      })
    })

    vi.stubGlobal('window', {
      fetch: fetchMock,
      location: { origin: 'http://localhost' }
    })

    const result = await requestImageEdit(provider, {
      originalImage: 'data:image/png;base64,BBBB',
      selectionRect: { x: 10, y: 20, width: 30, height: 40 },
      selectionRectNormalized: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
      prompt: 'remove the logo',
      resolution: '2K',
      aspectRatio: 'auto',
      enableModelSuffix: true
    })

    expect(result).toBe('data:image/png;base64,AAAA')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('sends redundant OpenAI and Gemini fields for Gemini image edit requests', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body))

      expect(payload.messages).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                'You are performing localized image editing.',
                'Only modify the selected rectangle and preserve all pixels outside that area as much as possible.',
                'Use the original full image as global context.',
                'Pixel rectangle: x=10, y=20, width=30, height=40.',
                'Normalized rectangle: x=0.1000, y=0.2000, width=0.3000, height=0.4000.',
                'Edit request: remove the logo'
              ].join('\n')
            },
            {
              type: 'image_url',
              image_url: {
                url: 'data:image/png;base64,BBBB'
              }
            }
          ]
        }
      ])
      expect(payload.contents).toEqual([
        {
          role: 'user',
          parts: [
            {
              text: [
                'You are performing localized image editing.',
                'Only modify the selected rectangle and preserve all pixels outside that area as much as possible.',
                'Use the original full image as global context.',
                'Pixel rectangle: x=10, y=20, width=30, height=40.',
                'Normalized rectangle: x=0.1000, y=0.2000, width=0.3000, height=0.4000.',
                'Edit request: remove the logo'
              ].join('\n')
            },
            {
              inline_data: {
                mime_type: 'image/png',
                data: 'BBBB'
              }
            }
          ]
        }
      ])
      expect(payload.generationConfig).toEqual({
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          imageSize: '2K',
          aspectRatio: '16:9'
        }
      })
      expect(payload.aspect_ratio).toBe('16:9')

      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: 'image/png',
                      data: 'CCCC'
                    }
                  }
                ]
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    })

    vi.stubGlobal('window', {
      fetch: fetchMock,
      location: { origin: 'http://localhost' }
    })

    const result = await requestImageEdit(geminiProvider, {
      originalImage: 'data:image/png;base64,BBBB',
      selectionRect: { x: 10, y: 20, width: 30, height: 40 },
      selectionRectNormalized: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
      prompt: 'remove the logo',
      resolution: '2K',
      aspectRatio: '16:9',
      enableModelSuffix: true
    })

    expect(result).toBe('data:image/png;base64,CCCC')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

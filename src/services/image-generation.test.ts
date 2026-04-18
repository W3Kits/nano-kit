import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Provider } from '@/types'
import { requestImageGeneration } from './image-generation'

const openAIProvider: Provider = {
  id: 'openai-1',
  name: 'OpenAI',
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
  id: 'gemini-1',
  name: 'Gemini',
  type: 'gemini',
  host: 'https://example.com',
  key: 'secret',
  textModel: 'gemini-3-flash',
  imageModel: 'gemini-3-pro-image',
  capabilities: {
    image: true,
    text: true
  },
  enableModelSuffix: true
}

describe('requestImageGeneration', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the shared OpenAI image request path with SSE and mixed TEXT/IMAGE modalities', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body))

      expect(payload.model).toBe('gpt-image-1')
      expect(payload.stream).toBe(true)
      expect(payload.messages).toEqual([
        {
          role: 'user',
          content: [{ type: 'text', text: 'draw a city skyline' }]
        }
      ])
      expect(payload.contents).toEqual([
        {
          role: 'user',
          parts: [{ text: 'draw a city skyline' }]
        }
      ])
      expect(payload.size).toBe('2048x2048')
      expect(payload.aspect_ratio).toBe('16:9')
      expect(payload.generationConfig).toEqual({
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          imageSize: '2K',
          aspectRatio: '16:9'
        }
      })

      const body = [
        'data: {"choices":[{"delta":{"content":"Scene analysis\\n"}}]}',
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

    const result = await requestImageGeneration(openAIProvider, {
      prompt: 'draw a city skyline',
      quality: '2K',
      ratio: '16:9'
    })

    expect(result).toBe('data:image/png;base64,AAAA')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('uses the shared Gemini image request path and extracts inlineData images', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body))

      expect(payload.model).toBeUndefined()
      expect(payload.stream).toBe(true)
      expect(payload.messages).toEqual([
        {
          role: 'user',
          content: [{ type: 'text', text: 'draw a forest' }]
        }
      ])
      expect(payload.contents).toEqual([
        {
          role: 'user',
          parts: [{ text: 'draw a forest' }]
        }
      ])
      expect(payload.size).toBe('1024x1024')
      expect(payload.aspect_ratio).toBeUndefined()
      expect(payload.generationConfig).toEqual({
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          imageSize: '1K'
        }
      })

      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: 'image/png',
                      data: 'BBBB'
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

    const result = await requestImageGeneration(geminiProvider, {
      prompt: 'draw a forest',
      quality: '1K',
      ratio: 'auto'
    })

    expect(result).toBe('data:image/png;base64,BBBB')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws when the shared image request does not return any images', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: 'text only'
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

    await expect(
      requestImageGeneration(openAIProvider, {
        prompt: 'draw a city skyline',
        quality: '1K',
        ratio: 'auto'
      })
    ).rejects.toThrow('未返回图片数据')
  })
})

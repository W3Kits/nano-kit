import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Provider } from '@/types'
import { requestImageGeneration, requestTextGeneration } from './image-generation'

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

  it('uses the OpenAI images generation endpoint for image models', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://example.com/v1/images/generations')
      const payload = JSON.parse(String(init?.body))

      expect(payload.model).toBe('gpt-image-1')
      expect(payload.prompt).toBe('draw a city skyline')
      expect(payload.n).toBe(1)
      expect(payload.size).toBe('2048x2048')
      expect(payload.messages).toBeUndefined()
      expect(payload.contents).toBeUndefined()

      return new Response(JSON.stringify({ data: [{ b64_json: 'AAAA' }] }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
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

  it('does not send OpenAI image-only models to chat completions', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://example.com/v1/chat/completions')
      const payload = JSON.parse(String(init?.body))

      expect(payload.model).toBe('gpt-5.4-mini')
      expect(payload.messages).toHaveLength(2)

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: 'ok'
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

    const result = await requestTextGeneration(
      {
        ...openAIProvider,
        textModel: 'gpt-image-2'
      },
      {
        systemPrompt: 'system',
        userPrompt: 'user'
      }
    )

    expect(result).toBe('ok')
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

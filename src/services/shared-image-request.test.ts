import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Provider } from '@/types'
import { requestSharedImage } from './shared-image-request'

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
  ...openAIProvider,
  id: 'gemini-1',
  name: 'Gemini',
  type: 'gemini',
  textModel: 'gemini-3-flash',
  imageModel: 'gemini-3-pro-image'
}

describe('requestSharedImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the OpenAI image generation endpoint and normalizes image responses', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          data: [
            {
              b64_json: 'AAAA',
              revised_prompt: 'draft copy'
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

    const result = await requestSharedImage(openAIProvider, {
      prompt: 'draw a city skyline',
      images: [],
      resolution: '1K',
      aspectRatio: 'auto',
      stream: true,
      responseModalities: ['TEXT', 'IMAGE']
    })

    expect(result).toEqual({
      images: ['data:image/png;base64,AAAA'],
      text: 'draft copy'
    })
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/v1/images/generations', expect.objectContaining({
      method: 'POST'
    }))
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      model: 'gpt-image-1',
      prompt: 'draw a city skyline',
      size: '1024x1024'
    })
  })

  it('uses the OpenAI image edits endpoint with multipart image data', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          data: [
            {
              b64_json: 'BBBB'
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

    const result = await requestSharedImage(openAIProvider, {
      prompt: 'replace the sky',
      images: [
        {
          dataUrl: 'data:image/png;base64,AAAA',
          mimeType: 'image/png',
          base64Data: 'AAAA'
        }
      ],
      resolution: '1K',
      aspectRatio: 'auto',
      stream: true,
      responseModalities: ['TEXT', 'IMAGE']
    })

    const requestInit = fetchMock.mock.calls[0][1]

    expect(result).toEqual({
      images: ['data:image/png;base64,BBBB'],
      text: ''
    })
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/v1/images/edits', expect.objectContaining({
      method: 'POST'
    }))
    expect(requestInit?.body).toBeInstanceOf(FormData)
    expect(requestInit?.headers).not.toHaveProperty('Content-Type')
  })

  it('normalizes Gemini responses with inlineData and text markdown images', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'notes\n![embedded](data:image/jpeg;base64,BBBB)'
                  },
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

    const result = await requestSharedImage(geminiProvider, {
      prompt: 'draw a forest',
      images: [],
      resolution: '1K',
      aspectRatio: 'auto',
      stream: true,
      responseModalities: ['TEXT', 'IMAGE']
    })

    expect(result).toEqual({
      images: ['data:image/jpeg;base64,BBBB', 'data:image/png;base64,CCCC'],
      text: 'notes'
    })
  })
})

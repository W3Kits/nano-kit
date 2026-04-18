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

  it('normalizes OpenAI JSON responses into text and images', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: 'draft copy\n![result](data:image/png;base64,AAAA)'
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

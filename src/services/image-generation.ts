import type { Provider } from '../types'
import { buildGeminiUrl, buildOpenAIUrl, nativeFetch } from '../utils/helpers'
import { requestSharedImage } from './shared-image-request'
import {
  getW3KitsOpenAiBaseUrl,
  getW3KitsOpenAiHeaders,
  isManagedOpenAiProvider,
  isW3KitsLoginRequired,
  requestW3KitsLogin
} from '@/lib/w3kits-runtime'

export type ImageQuality = '1K' | '2K' | '4K'

export interface TextGenerationInput {
  systemPrompt: string
  userPrompt: string
}

export interface ImageGenerationInput {
  prompt: string
  quality: ImageQuality
  ratio: string
  enableModelSuffix?: boolean
}

export async function requestTextGeneration(
  config: Provider,
  input: TextGenerationInput
): Promise<string> {
  const { systemPrompt, userPrompt } = input

  if (config.type === 'openai') {
    const useManagedAuth = isManagedOpenAiProvider(config)
    const headers = useManagedAuth
      ? await getW3KitsOpenAiHeaders()
      : {
          Authorization: `Bearer ${config.key}`,
          'Content-Type': 'application/json'
        }

    const res = await nativeFetch(buildOpenAIUrl(useManagedAuth ? getW3KitsOpenAiBaseUrl() : config.host, '/chat/completions'), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.textModel,
        stream: false,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ]
      })
    })

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}))
      if (useManagedAuth && isW3KitsLoginRequired(payload, res.status)) {
        requestW3KitsLogin('ai_request')
        throw new Error('Sign in required before using the default OpenAI-compatible provider.')
      }
      throw new Error(`HTTP ${res.status}`)
    }

    const data = await res.json()
    if (data.error) throw new Error(data.error.message)
    return data.choices?.[0]?.message?.content || ''
  }

  const res = await nativeFetch(
    buildGeminiUrl(config.host, `/models/${config.textModel}:generateContent`),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.key
      },
      body: JSON.stringify({
        systemInstruction: {
          role: 'system',
          parts: [{ text: systemPrompt }]
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }]
          }
        ],
        generationConfig: { responseModalities: ['TEXT'] }
      })
    }
  )

  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const data = await res.json()
  return (data.candidates?.[0]?.content?.parts || [])
    .map((part: any) => part.text)
    .filter(Boolean)
    .join('')
}

export async function requestImageGeneration(
  config: Provider,
  input: ImageGenerationInput
): Promise<string> {
  const { prompt, quality, ratio, enableModelSuffix = true } = input
  const result = await requestSharedImage(config, {
    prompt,
    images: [],
    resolution: quality,
    aspectRatio: ratio,
    enableModelSuffix,
    stream: true,
    responseModalities: ['TEXT', 'IMAGE']
  })

  if (result.images[0]) return result.images[0]

  throw new Error('未返回图片数据')
}

export function normalizeModelBlocks(parsed: unknown): any[] {
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') {
    const blocks = (parsed as any).blocks
    if (Array.isArray(blocks)) return blocks
    return [parsed]
  }
  return []
}

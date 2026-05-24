import type { Provider } from '@/types'
import { buildDynamicImageModel, buildGeminiUrl, buildOpenAIUrl, nativeFetch } from '@/utils/helpers'
import { buildRedundantImagePayload } from './image-payloads'
import {
  getW3KitsOpenAiBaseUrl,
  getW3KitsOpenAiHeaders,
  isManagedOpenAiProvider,
  isW3KitsLoginRequired,
  requestW3KitsLogin
} from '@/lib/w3kits-runtime'

export interface SharedImageRequestInput {
  prompt: string
  images: Array<{ dataUrl: string; mimeType: string; base64Data: string }>
  resolution: string
  aspectRatio: string
  enableModelSuffix?: boolean
  stream: boolean
  responseModalities: string[]
}

export interface SharedImageResult {
  images: string[]
  text: string
}

export async function requestSharedImage(
  config: Provider,
  input: SharedImageRequestInput
): Promise<SharedImageResult> {
  const model = buildDynamicImageModel(
    config.imageModel,
    input.resolution,
    input.aspectRatio,
    input.enableModelSuffix
  )
  const payload = buildRedundantImagePayload(input)

  if (config.type === 'openai') {
    const useManagedAuth = isManagedOpenAiProvider(config)
    const baseUrl = useManagedAuth ? getW3KitsOpenAiBaseUrl() : config.host
    const authHeaders = useManagedAuth
      ? await getW3KitsOpenAiHeaders()
      : { Authorization: `Bearer ${config.key}` }
    const isEditRequest = input.images.length > 0
    const endpoint = isEditRequest ? '/images/edits' : '/images/generations'
    const requestInit = isEditRequest
      ? buildOpenAIImageEditRequest(authHeaders, model, input, payload)
      : buildOpenAIImageGenerationRequest(authHeaders, model, input, payload)

    const res = await nativeFetch(buildOpenAIUrl(baseUrl, endpoint), requestInit)

    if (!res.ok) {
      const error = await parseOpenAIError(res)
      if (useManagedAuth && isW3KitsLoginRequired(error, res.status)) {
        requestW3KitsLogin('ai_request')
        throw new Error('Sign in required before using the default OpenAI-compatible provider.')
      }
      throw new Error(error || `HTTP ${res.status}`)
    }

    const contentType = res.headers.get('content-type') || ''
    const data = contentType.includes('text/event-stream')
      ? await parseOpenAIStreamResponse(res)
      : await res.json()

    if (data?.error?.message) throw new Error(data.error.message)

    return await normalizeSharedImageResult(data)
  }

  const res = await nativeFetch(buildGeminiUrl(config.host, `/models/${model}:generateContent`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.key
    },
    body: JSON.stringify(payload)
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error?.message || `HTTP ${res.status}`)
  }
  if (data?.error?.message) throw new Error(data.error.message)

  return await normalizeSharedImageResult(data)
}

function buildOpenAIImageGenerationRequest(
  headers: Record<string, string>,
  model: string,
  input: SharedImageRequestInput,
  payload: any
): RequestInit {
  return {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      prompt: input.prompt || 'Generate image',
      n: 1,
      size: payload.size
    })
  }
}

function buildOpenAIImageEditRequest(
  headers: Record<string, string>,
  model: string,
  input: SharedImageRequestInput,
  payload: any
): RequestInit {
  const formData = new FormData()
  formData.append('model', model)
  formData.append('prompt', input.prompt || 'Edit image')
  formData.append('n', '1')
  if (payload.size) formData.append('size', payload.size)

  input.images.forEach((image, index) => {
    formData.append(
      'image',
      base64ImageToBlob(image.base64Data, image.mimeType),
      `image-${index + 1}.${imageExtension(image.mimeType)}`
    )
  })

  const formHeaders = { ...headers }
  delete formHeaders['Content-Type']
  delete formHeaders['content-type']

  return {
    method: 'POST',
    headers: formHeaders,
    body: formData
  }
}

async function parseOpenAIError(response: Response): Promise<string> {
  const text = await response.text()
  if (!text) return ''

  try {
    const data = JSON.parse(text)
    return data?.error?.message || text
  } catch {
    return text
  }
}

async function parseOpenAIStreamResponse(response: Response): Promise<any> {
  const reader = response.body?.getReader()
  if (!reader) {
    return {
      choices: [
        {
          message: {
            content: ''
          }
        }
      ]
    }
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line.startsWith('data:')) continue

      const data = line.slice(5).trim()
      if (!data || data === '[DONE]') continue

      try {
        const json = JSON.parse(data)
        const deltaContent = json?.choices?.[0]?.delta?.content
        if (typeof deltaContent === 'string') {
          fullContent += deltaContent
          continue
        }

        if (Array.isArray(deltaContent)) {
          fullContent += deltaContent
            .map((part: any) => {
              if (typeof part === 'string') return part
              if (typeof part?.text === 'string') return part.text
              return ''
            })
            .join('')
        }
      } catch (error) {
        console.warn('Parse SSE error:', error)
      }
    }
  }

  return {
    choices: [
      {
        message: {
          content: fullContent
        }
      }
    ]
  }
}

async function normalizeSharedImageResult(data: any): Promise<SharedImageResult> {
  const images: string[] = []
  const textParts: string[] = []

  if (Array.isArray(data?.data)) {
    for (const item of data.data) {
      if (typeof item?.b64_json === 'string' && item.b64_json) {
        images.push(`data:${item.mime_type || 'image/png'};base64,${item.b64_json}`)
      }

      if (typeof item?.url === 'string' && item.url) {
        const remoteImage = await convertRemoteImageToDataUrl(item.url)
        images.push(remoteImage || item.url)
      }

      if (typeof item?.revised_prompt === 'string' && item.revised_prompt) {
        textParts.push(item.revised_prompt)
      }
    }
  }

  const openAIContent = data?.choices?.[0]?.message?.content
  if (typeof openAIContent === 'string') {
    const extracted = await extractMarkdownImages(openAIContent)
    images.push(...extracted.images)
    if (extracted.text) textParts.push(extracted.text)
  } else if (Array.isArray(openAIContent)) {
    for (const part of openAIContent) {
      if (typeof part?.text === 'string') {
        const extracted = await extractMarkdownImages(part.text)
        images.push(...extracted.images)
        if (extracted.text) textParts.push(extracted.text)
      }

      const imageUrl = part?.image_url?.url
      if (typeof imageUrl === 'string' && imageUrl.startsWith('data:image/')) {
        images.push(imageUrl)
      }
    }
  }

  const geminiParts = data?.candidates?.[0]?.content?.parts
  if (Array.isArray(geminiParts)) {
    for (const part of geminiParts) {
      const inlineData = part?.inlineData
      if (inlineData?.data && inlineData?.mimeType) {
        images.push(`data:${inlineData.mimeType};base64,${inlineData.data}`)
      }

      if (typeof part?.text === 'string') {
        const extracted = await extractMarkdownImages(part.text)
        images.push(...extracted.images)
        if (extracted.text) textParts.push(extracted.text)
      }
    }
  }

  return {
    images: dedupe(images),
    text: textParts.join('\n').trim()
  }
}

async function extractMarkdownImages(content: string): Promise<SharedImageResult> {
  const images: string[] = []
  let text = content
  const regex = /!\[[^\]]*]\(((?:data:image\/|https?:\/\/)[^)]+)\)/g
  const matches = Array.from(content.matchAll(regex))

  for (const match of matches) {
    const url = match[1]
    if (!url) continue

    if (url.startsWith('data:image/')) {
      images.push(url)
      continue
    }

    const remoteImage = await convertRemoteImageToDataUrl(url)
    if (remoteImage) images.push(remoteImage)
  }

  text = text.replace(regex, '').trim()

  return { images, text }
}

async function convertRemoteImageToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await nativeFetch(url)
    if (!res.ok) return null

    const blob = await res.blob()
    const mimeType = blob.type || 'image/jpeg'
    const arrayBuffer = await blob.arrayBuffer()
    const base64 = arrayBufferToBase64(arrayBuffer)
    return `data:${mimeType};base64,${base64}`
  } catch {
    return null
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  if (typeof btoa === 'function') {
    return btoa(binary)
  }

  const nodeBuffer = (globalThis as any).Buffer
  if (nodeBuffer) {
    return nodeBuffer.from(bytes).toString('base64')
  }

  throw new Error('Base64 encoding unavailable')
}

function base64ImageToBlob(base64Data: string, mimeType: string): Blob {
  const binary = decodeBase64(base64Data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType || 'image/png' })
}

function decodeBase64(value: string): string {
  if (typeof atob === 'function') return atob(value)

  const nodeBuffer = (globalThis as any).Buffer
  if (nodeBuffer) return nodeBuffer.from(value, 'base64').toString('binary')

  throw new Error('Base64 decoding unavailable')
}

function imageExtension(mimeType: string): string {
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg'
  if (mimeType.includes('webp')) return 'webp'
  if (mimeType.includes('gif')) return 'gif'
  return 'png'
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

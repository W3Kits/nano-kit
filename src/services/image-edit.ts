import type { Provider } from '@/types'
import type { ImageEditRequest } from '@/features/image-editor/geometry'
import { buildDynamicImageModel, buildGeminiUrl, buildOpenAIUrl, nativeFetch } from '@/utils/helpers'
import { buildRedundantImagePayload, createImagePartFromDataUrl } from './image-payloads'

export async function requestImageEdit(
  config: Provider,
  input: ImageEditRequest
): Promise<string> {
  const prompt = createImageEditPrompt(input)
  const model = buildDynamicImageModel(
    config.imageModel,
    input.resolution,
    input.aspectRatio,
    input.enableModelSuffix
  )
  const payload = {
    model,
    ...buildRedundantImagePayload({
      prompt,
      images: [createImagePartFromDataUrl(input.originalImage)],
      resolution: input.resolution,
      aspectRatio: input.aspectRatio,
      stream: true,
      responseModalities: ['TEXT', 'IMAGE']
    })
  }

  if (config.type === 'openai') {
    const res = await nativeFetch(buildOpenAIUrl(config.host, '/chat/completions'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(errorText || `HTTP ${res.status}`)
    }

    const contentType = res.headers.get('content-type') || ''
    const data = contentType.includes('text/event-stream')
      ? await parseStreamResponse(res)
      : await res.json()

    return extractImageFromResponse(data)
  }

  const res = await nativeFetch(
    buildGeminiUrl(config.host, `/models/${model}:generateContent`),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.key
      },
      body: JSON.stringify(payload)
    }
  )

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error?.message || `HTTP ${res.status}`)
  }

  return extractImageFromResponse(data)
}

function createImageEditPrompt(input: ImageEditRequest): string {
  const rect = input.selectionRect
  const normalized = input.selectionRectNormalized
  return [
    'You are performing localized image editing.',
    'Only modify the selected rectangle and preserve all pixels outside that area as much as possible.',
    'Use the original full image as global context.',
    `Pixel rectangle: x=${rect.x}, y=${rect.y}, width=${rect.width}, height=${rect.height}.`,
    `Normalized rectangle: x=${normalized.x.toFixed(4)}, y=${normalized.y.toFixed(4)}, width=${normalized.width.toFixed(4)}, height=${normalized.height.toFixed(4)}.`,
    `Edit request: ${input.prompt}`
  ].join('\n')
}

async function parseStreamResponse(response: Response) {
  const reader = response.body?.getReader()
  if (!reader) {
    return {
      choices: [{
        message: { content: '' }
      }]
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

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue

      const data = line.slice(6).trim()
      if (data === '[DONE]') continue

      try {
        const json = JSON.parse(data)
        const deltaContent = json.choices?.[0]?.delta?.content
        if (typeof deltaContent === 'string') {
          fullContent += deltaContent
        }
      } catch (error) {
        console.warn('Parse SSE error:', error)
      }
    }
  }

  return {
    choices: [{
      message: { content: fullContent }
    }]
  }
}

function extractImageFromResponse(data: any): string {
  const openAIContent = data?.choices?.[0]?.message?.content || ''
  if (typeof openAIContent === 'string') {
    const match = openAIContent.match(/!\[.*?\]\((data:image\/[^)]+)\)/)
    if (match) return match[1]
  }

  const parts = data?.candidates?.[0]?.content?.parts
  if (Array.isArray(parts)) {
    const inlineData = parts.find((part: any) => part.inlineData?.data)?.inlineData
    if (inlineData?.data && inlineData?.mimeType) {
      return `data:${inlineData.mimeType};base64,${inlineData.data}`
    }
  }

  throw new Error('未返回图片数据')
}

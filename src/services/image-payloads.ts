export type ImageResolution = '1K' | '2K' | '4K'

export interface RedundantImageInput {
  prompt: string
  images: RedundantImagePart[]
  resolution: string
  aspectRatio: string
  stream: boolean
  responseModalities: string[]
}

export interface RedundantImagePart {
  dataUrl: string
  mimeType: string
  base64Data: string
}

export function createImagePartFromDataUrl(dataUrl: string): RedundantImagePart {
  return {
    dataUrl,
    mimeType: getMimeType(dataUrl),
    base64Data: getBase64Data(dataUrl)
  }
}

export function buildRedundantImagePayload(input: RedundantImageInput) {
  const resolution = normalizeImageResolution(input.resolution)
  const text = input.prompt || 'Generate image'
  const openAIContent: any[] = [{ type: 'text', text }]
  const geminiParts: any[] = [{ text }]

  input.images.forEach((image) => {
    openAIContent.push({
      type: 'image_url',
      image_url: {
        url: image.dataUrl
      }
    })
    geminiParts.push({
      inline_data: {
        mime_type: image.mimeType,
        data: image.base64Data
      }
    })
  })

  const payload: any = {
    messages: [
      {
        role: 'user',
        content: openAIContent
      }
    ],
    contents: [
      {
        role: 'user',
        parts: geminiParts
      }
    ],
    stream: input.stream,
    size: getOpenAIImageSize(resolution),
    generationConfig: {
      responseModalities: input.responseModalities,
      imageConfig: {
        imageSize: resolution
      }
    }
  }

  if (input.aspectRatio && input.aspectRatio !== 'auto') {
    payload.aspect_ratio = input.aspectRatio
    payload.generationConfig.imageConfig.aspectRatio = input.aspectRatio
  }

  return payload
}

function normalizeImageResolution(resolution: string): ImageResolution {
  if (resolution === '2K' || resolution === '4K') return resolution
  return '1K'
}

function getOpenAIImageSize(resolution: ImageResolution): string {
  if (resolution === '2K') return '2048x2048'
  if (resolution === '4K') return '4096x4096'
  return '1024x1024'
}

function getBase64Data(dataUrl: string): string {
  return dataUrl.split(',')[1] || ''
}

function getMimeType(dataUrl: string): string {
  return dataUrl.match(/^data:([^;]+);base64,/)?.[1] || 'image/png'
}

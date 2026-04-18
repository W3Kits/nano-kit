import type { Provider } from '@/types'
import type { ImageEditRequest } from '@/features/image-editor/geometry'
import { createImagePartFromDataUrl } from './image-payloads'
import { requestSharedImage } from './shared-image-request'

export async function requestImageEdit(
  config: Provider,
  input: ImageEditRequest
): Promise<string> {
  const prompt = createImageEditPrompt(input)
  const { images } = await requestSharedImage(config, {
    prompt,
    images: [createImagePartFromDataUrl(input.originalImage)],
    resolution: input.resolution,
    aspectRatio: input.aspectRatio,
    enableModelSuffix: input.enableModelSuffix,
    stream: true,
    responseModalities: ['TEXT', 'IMAGE']
  })

  const firstImage = images[0]
  if (!firstImage) {
    throw new Error('未返回图片数据')
  }

  return firstImage
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

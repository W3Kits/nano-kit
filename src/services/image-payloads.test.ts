import { describe, expect, it } from 'vitest'
import {
  buildRedundantImagePayload,
  createImagePartFromDataUrl
} from './image-payloads'

describe('image payload redundancy builder', () => {
  it('builds an image generation payload with both OpenAI and Gemini fields', () => {
    const payload = buildRedundantImagePayload({
      prompt: 'draw a mountain at sunrise',
      images: [],
      resolution: '2K',
      aspectRatio: '16:9',
      stream: false,
      responseModalities: ['IMAGE']
    })

    expect(payload.messages).toEqual([
      {
        role: 'user',
        content: [{ type: 'text', text: 'draw a mountain at sunrise' }]
      }
    ])
    expect(payload.contents).toEqual([
      {
        role: 'user',
        parts: [{ text: 'draw a mountain at sunrise' }]
      }
    ])
    expect(payload.size).toBe('2048x2048')
    expect(payload.aspect_ratio).toBe('16:9')
    expect(payload.generationConfig).toEqual({
      responseModalities: ['IMAGE'],
      imageConfig: {
        imageSize: '2K',
        aspectRatio: '16:9'
      }
    })
  })

  it('omits explicit ratio fields when aspect ratio is auto', () => {
    const payload = buildRedundantImagePayload({
      prompt: 'draw a lake',
      images: [],
      resolution: '1K',
      aspectRatio: 'auto',
      stream: true,
      responseModalities: ['TEXT', 'IMAGE']
    })

    expect(payload.aspect_ratio).toBeUndefined()
    expect(payload.generationConfig).toEqual({
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        imageSize: '1K'
      }
    })
  })

  it('duplicates image inputs into image_url and inline_data formats', () => {
    const image = createImagePartFromDataUrl('data:image/png;base64,QUJDRA==')
    const payload = buildRedundantImagePayload({
      prompt: 'edit this image',
      images: [image],
      resolution: '4K',
      aspectRatio: '4:3',
      stream: true,
      responseModalities: ['TEXT', 'IMAGE']
    })

    expect(payload.messages[0].content).toEqual([
      { type: 'text', text: 'edit this image' },
      {
        type: 'image_url',
        image_url: {
          url: 'data:image/png;base64,QUJDRA=='
        }
      }
    ])
    expect(payload.contents[0].parts).toEqual([
      { text: 'edit this image' },
      {
        inline_data: {
          mime_type: 'image/png',
          data: 'QUJDRA=='
        }
      }
    ])
  })
})

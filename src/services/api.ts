import { useAppStore } from '../store/appStore'
import { escapeHtml } from '../utils/helpers'
import type { ImageState } from '../types'
import * as db from '../utils/db'
import { createImagePartFromDataUrl, type RedundantImagePart } from './image-payloads'
import { requestSharedImage, type SharedImageResult } from './shared-image-request'

export async function sendMessage(text: string, images: ImageState[]) {
  const store = useAppStore.getState()
  const {
    resolution,
    aspectRatio,
    getActiveConfig,
    saveMessage,
    updateSessionTitle,
    loadSessions,
    addActiveGeneration,
    removeActiveGeneration
  } = store

  const config = getActiveConfig()

  if (!config) {
    throw new Error('请先在设置中添加 API 渠道')
  }
  if (!config.imageModel) {
    throw new Error('请先在设置中填写绘图模型')
  }

  // Single-turn generation: every send starts a fresh session.
  const sessionId = await store.createSession('新对话')

  // Save user message
  const userHtml = text ? `<div class="msg-content">${escapeHtml(text).replace(/\n/g, '<br>')}</div>` : ''
  const imagesBase64 = images.map(i => i.base64)
  await saveMessage(sessionId, 'user', text, imagesBase64, userHtml)

  // Update session title if first message
  const messages = await db.getSessionMessages(sessionId)
  if (messages.length <= 1 && text) {
    const newTitle = text.substring(0, 20) + (text.length > 20 ? '...' : '')
    await updateSessionTitle(sessionId, newTitle)
    await loadSessions()
  }

  // Add loading message
  addActiveGeneration(sessionId)

  try {
    const data = await requestSharedImage(config, {
      prompt: text || 'Generate image',
      images: toSharedImageParts(images),
      resolution,
      aspectRatio,
      enableModelSuffix: config.enableModelSuffix ?? true,
      stream: true,
      responseModalities: ['TEXT', 'IMAGE']
    })

    // Process response
    await processResponse(data, sessionId)

  } catch (e: any) {
    console.error('API Error:', e)
    let msg = e.message || '未知错误'
    try {
      const jsonErr = JSON.parse(e.message)
      if (jsonErr.error?.message) msg = jsonErr.error.message
    } catch (_) {}

    const errorHtml = `<div class="msg-content" style="color:#d93025">❌ Error: ${escapeHtml(msg)}</div>`
    await saveMessage(sessionId, 'bot', 'Error', [], errorHtml)
    throw new Error(msg)
  } finally {
    removeActiveGeneration(sessionId)
  }
}

async function processResponse(data: SharedImageResult, sessionId: number) {
  const store = useAppStore.getState()
  const { saveMessage, bumpGalleryRefreshKey } = store

  let botHtml = ''
  const generatedImages: string[] = []

  const textContent = typeof data.text === 'string' ? data.text.trim() : ''
  if (textContent) {
    botHtml += `<div class="msg-content" style="padding:12px 18px; white-space:pre-wrap;">${escapeHtml(textContent)}</div>`
  }

  for (const image of data.images || []) {
    const normalized = normalizeGeneratedImage(image)
    if (!normalized) continue

    generatedImages.push(normalized.base64)
    botHtml += createImageHtml(normalized.dataUrl, `image_${Date.now()}.png`)
  }

  if (botHtml) {
    await saveMessage(sessionId, 'bot', 'Image Generated', generatedImages, botHtml)
    bumpGalleryRefreshKey()
    store.showToast('生成完成', 'success')
  }
}

function toSharedImageParts(images: Array<ImageState | string>): RedundantImagePart[] {
  return images
    .map((image) => {
      if (typeof image === 'string') {
        return createImagePartFromDataUrl(normalizeDataUrl(image, 'image/jpeg'))
      }

      const dataUrl = image.preview || `data:${image.mimeType};base64,${image.base64}`
      return createImagePartFromDataUrl(dataUrl)
    })
    .filter((part) => Boolean(part.base64Data))
}

function normalizeGeneratedImage(image: string): { dataUrl: string; base64: string } | null {
  if (!image) return null

  if (image.startsWith('data:')) {
    const base64 = image.split(',')[1]
    if (!base64) return null
    return { dataUrl: image, base64 }
  }

  return {
    dataUrl: normalizeDataUrl(image, 'image/png'),
    base64: image
  }
}

function normalizeDataUrl(value: string, mimeType: string): string {
  if (value.startsWith('data:')) return value
  return `data:${mimeType};base64,${value}`
}

function createImageHtml(fullBase64: string, filename: string): string {
  return `
    <div class="msg-content" style="padding:0">
      <div class="img-result-group">
        <img class="generated-image" src="${fullBase64}" data-filename="${filename}">
        <div class="btn-group">
          <div class="tool-btn download">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg> 下载原图
          </div>
          <div class="tool-btn">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg> 设为参考图
          </div>
          <div class="tool-btn slice-btn">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 3L6 21"/>
              <path d="M18 3L18 21"/>
              <path d="M2 12L22 12"/>
            </svg> 切割/表情包
          </div>
        </div>
      </div>
    </div>
  `
}

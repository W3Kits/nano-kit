import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Provider } from '@/types'

const requestSharedImage = vi.fn()
const getSessionMessages = vi.fn()
const getState = vi.fn()

vi.mock('./shared-image-request', () => ({
  requestSharedImage
}))

vi.mock('../utils/db', () => ({
  getSessionMessages
}))

vi.mock('../store/appStore', () => ({
  useAppStore: {
    getState
  }
}))

const provider: Provider = {
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

describe('sendMessage', () => {
  const saveMessage = vi.fn()
  const updateSessionTitle = vi.fn()
  const loadSessions = vi.fn()
  const addActiveGeneration = vi.fn()
  const removeActiveGeneration = vi.fn()
  const createSession = vi.fn()
  const bumpGalleryRefreshKey = vi.fn()
  const showToast = vi.fn()

  beforeEach(() => {
    saveMessage.mockReset()
    updateSessionTitle.mockReset()
    loadSessions.mockReset()
    addActiveGeneration.mockReset()
    removeActiveGeneration.mockReset()
    createSession.mockReset()
    bumpGalleryRefreshKey.mockReset()
    showToast.mockReset()
    requestSharedImage.mockReset()
    getSessionMessages.mockReset()

    createSession.mockResolvedValue(123)
    getSessionMessages.mockResolvedValue([{ id: 1 }])
    requestSharedImage.mockResolvedValue({
      images: ['data:image/png;base64,AAAA'],
      text: 'scene summary'
    })

    getState.mockReturnValue({
      resolution: '2K',
      aspectRatio: '16:9',
      getActiveConfig: () => provider,
      saveMessage,
      updateSessionTitle,
      loadSessions,
      addActiveGeneration,
      removeActiveGeneration,
      createSession,
      bumpGalleryRefreshKey,
      showToast
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('routes homepage generation through the shared image request and stores normalized output', async () => {
    const { sendMessage } = await import('./api')

    await sendMessage('draw a skyline', [
      {
        base64: 'BBBB',
        mimeType: 'image/png',
        preview: 'data:image/png;base64,BBBB'
      }
    ])

    expect(requestSharedImage).toHaveBeenCalledWith(provider, {
      prompt: 'draw a skyline',
      images: [
        {
          dataUrl: 'data:image/png;base64,BBBB',
          mimeType: 'image/png',
          base64Data: 'BBBB'
        }
      ],
      resolution: '2K',
      aspectRatio: '16:9',
      enableModelSuffix: true,
      stream: true,
      responseModalities: ['TEXT', 'IMAGE']
    })

    expect(saveMessage).toHaveBeenNthCalledWith(
      1,
      123,
      'user',
      'draw a skyline',
      ['BBBB'],
      '<div class="msg-content">draw a skyline</div>'
    )
    expect(saveMessage).toHaveBeenNthCalledWith(
      2,
      123,
      'bot',
      'Image Generated',
      ['AAAA'],
      expect.stringContaining('scene summary')
    )
    expect(saveMessage.mock.calls[1]?.[4]).toContain('data:image/png;base64,AAAA')
    expect(updateSessionTitle).toHaveBeenCalledWith(123, 'draw a skyline')
    expect(addActiveGeneration).toHaveBeenCalledWith(123)
    expect(removeActiveGeneration).toHaveBeenCalledWith(123)
    expect(bumpGalleryRefreshKey).toHaveBeenCalledTimes(1)
    expect(showToast).toHaveBeenCalledWith('生成完成', 'success')
  })
})

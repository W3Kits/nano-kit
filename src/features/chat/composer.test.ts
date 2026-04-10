import { describe, expect, it, vi } from 'vitest'
import type { ImageState, Provider } from '@/types'
import { submitComposerDraft } from './composer'

const image: ImageState = {
  base64: 'Zm9v',
  mimeType: 'image/png',
  preview: 'data:image/png;base64,Zm9v'
}

const provider: Provider = {
  id: 'p1',
  name: 'Primary',
  type: 'gemini',
  host: 'https://example.com',
  key: 'secret',
  textModel: 'gemini-3-flash',
  imageModel: 'gemini-3-pro-image',
  capabilities: {
    image: true,
    text: true
  },
  enableModelSuffix: true
}

describe('submitComposerDraft', () => {
  it('does not clear the draft when no provider is available', async () => {
    const clearDraft = vi.fn()
    const performSend = vi.fn()
    const setSending = vi.fn()

    const result = await submitComposerDraft(
      { text: 'hello', images: [image] },
      {
        getConfig: () => null,
        performSend,
        clearDraft,
        setSending
      }
    )

    expect(result).toEqual({
      ok: false,
      errorMessage: '请先在设置中添加 API 渠道'
    })
    expect(performSend).not.toHaveBeenCalled()
    expect(clearDraft).not.toHaveBeenCalled()
    expect(setSending).not.toHaveBeenCalled()
  })

  it('clears the draft only after a successful send', async () => {
    const callOrder: string[] = []
    const clearDraft = vi.fn(() => {
      callOrder.push('clear')
    })
    const performSend = vi.fn(async () => {
      callOrder.push('send')
    })
    const setSending = vi.fn((value: boolean) => {
      callOrder.push(value ? 'sending:on' : 'sending:off')
    })

    const result = await submitComposerDraft(
      { text: 'hello', images: [image] },
      {
        getConfig: () => provider,
        performSend,
        clearDraft,
        setSending
      }
    )

    expect(result).toEqual({ ok: true })
    expect(callOrder).toEqual(['sending:on', 'send', 'clear', 'sending:off'])
  })

  it('preserves the draft when send fails', async () => {
    const clearDraft = vi.fn()
    const setSending = vi.fn()

    const result = await submitComposerDraft(
      { text: 'hello', images: [image] },
      {
        getConfig: () => provider,
        performSend: vi.fn(async () => {
          throw new Error('boom')
        }),
        clearDraft,
        setSending
      }
    )

    expect(result).toEqual({
      ok: false,
      errorMessage: 'boom'
    })
    expect(clearDraft).not.toHaveBeenCalled()
    expect(setSending).toHaveBeenNthCalledWith(1, true)
    expect(setSending).toHaveBeenLastCalledWith(false)
  })
})

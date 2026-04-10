import type { ImageState, Provider } from '@/types'

export interface ComposerDraft {
  text: string
  images: ImageState[]
}

export interface SubmitComposerDraftDeps {
  getConfig: () => Provider | null
  performSend: (draft: ComposerDraft, config: Provider) => Promise<void>
  clearDraft: () => void
  setSending: (value: boolean) => void
}

export interface SubmitComposerDraftResult {
  ok: boolean
  errorMessage?: string
}

export async function submitComposerDraft(
  draft: ComposerDraft,
  deps: SubmitComposerDraftDeps
): Promise<SubmitComposerDraftResult> {
  const trimmedText = draft.text.trim()
  if (!trimmedText && draft.images.length === 0) {
    return { ok: false, errorMessage: '请输入提示词或上传图片' }
  }

  const config = deps.getConfig()
  if (!config) {
    return { ok: false, errorMessage: '请先在设置中添加 API 渠道' }
  }
  if (!config.imageModel) {
    return { ok: false, errorMessage: '请先在设置中填写绘图模型' }
  }

  deps.setSending(true)
  try {
    await deps.performSend(
      {
        text: trimmedText,
        images: draft.images
      },
      config
    )
    deps.clearDraft()
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      errorMessage: error instanceof Error ? error.message : '发送失败'
    }
  } finally {
    deps.setSending(false)
  }
}

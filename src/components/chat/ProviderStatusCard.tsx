import { useAppStore } from '@/store/appStore'

export default function ProviderStatusCard() {
  const { getActiveConfig, resolution, aspectRatio, openSettingsModal } = useAppStore()
  const imageConfig = getActiveConfig('image')
  const textConfig = getActiveConfig('text')

  const imageProvider = imageConfig?.name || '未配置图片 Provider'
  const imageModel = imageConfig?.imageModel || '未配置图片模型'
  const textProvider = textConfig?.name || '未配置文案 Provider'
  const providerType = imageConfig ? (imageConfig.type === 'gemini' ? 'Gemini' : 'OpenAI 兼容') : '未配置'

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-color)] bg-[rgba(255,255,255,0.78)] px-4 py-2.5 text-xs text-[var(--text-secondary)] backdrop-blur-sm shadow-sm">
      <p className="min-w-0 flex-1 truncate">
        当前配置：{imageProvider} / {providerType} / {imageModel} / {resolution} / {aspectRatio.toUpperCase()} / 文案：{textProvider}
      </p>
      <button
        type="button"
        onClick={openSettingsModal}
        className="shrink-0 text-[var(--link-color)] hover:underline"
      >
        设置
      </button>
    </div>
  )
}

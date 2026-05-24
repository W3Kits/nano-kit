import type { StateCreator } from 'zustand'
import type { Provider } from '../../types'
import type { AppState } from '../appStore'
import { safeStorageGet, scheduleStorageWrite } from '../utils/storage'
import {
  getW3KitsOpenAiBaseUrl,
  isW3KitsRuntime,
  W3KITS_MANAGED_OPENAI_KEY,
  W3KITS_DEFAULT_IMAGE_MODEL,
  W3KITS_DEFAULT_TEXT_MODEL
} from '@/lib/w3kits-runtime'

export interface ProviderSlice {
  providers: Provider[]
  activeProviderId: string
  activeTextProviderId: string
  initProviders: () => void
  saveProvider: (provider: Omit<Provider, 'id'> & { id?: string }) => string
  deleteProvider: (id: string) => void
  setActiveProvider: (id: string) => void
  setActiveTextProvider: (id: string) => void
  getActiveConfig: (capability?: 'image' | 'text') => Provider | null
}

const PROVIDERS_KEY = 'gemini_providers'
const ACTIVE_IMAGE_KEY = 'gemini_active_provider'
const ACTIVE_TEXT_KEY = 'gemini_active_text_provider'
const W3KITS_PROVIDER_ID = 'openai_default'

function createW3KitsProvider(): Provider {
  return {
    id: W3KITS_PROVIDER_ID,
    name: 'OpenAI Compatible',
    type: 'openai',
    host: getW3KitsOpenAiBaseUrl(),
    key: W3KITS_MANAGED_OPENAI_KEY,
    textModel: W3KITS_DEFAULT_TEXT_MODEL,
    imageModel: W3KITS_DEFAULT_IMAGE_MODEL,
    capabilities: { image: true, text: true },
    enableModelSuffix: false
  }
}

function persistableProviders(providers: Provider[]): Provider[] {
  return providers
}

function isOpenAIImageOnlyModel(model: string): boolean {
  const value = model.trim().toLowerCase()
  return value.startsWith('gpt-image-') || value.startsWith('dall-e-')
}

function normalizeOpenAITextModel(type: string, model: string): string {
  if (type === 'openai' && isOpenAIImageOnlyModel(model)) return W3KITS_DEFAULT_TEXT_MODEL
  return model
}

const normalizeProviders = (rawProviders: any[]) => {
  let didMutate = false
  const providers = rawProviders
    .filter(p => {
      const valid = p && typeof p === 'object'
      if (!valid) didMutate = true
      return valid
    })
    .map((p: any) => {
      const nextType =
        p.type === 'w3kits'
          ? 'openai'
          : (p.type === 'openai' || p.type === 'gemini' ? p.type : 'openai')
      const caps = {
        image: p.capabilities?.image ?? true,
        text: p.capabilities?.text ?? false
      }

      if (!p.capabilities) didMutate = true
      if (p.imageModel === undefined || p.textModel === undefined) didMutate = true
      if (p.model !== undefined) didMutate = true

      const legacyModel = typeof p.model === 'string' ? p.model : ''
      let imageModel = typeof p.imageModel === 'string' ? p.imageModel : ''
      let textModel = typeof p.textModel === 'string' ? p.textModel : ''

      if (!imageModel && legacyModel && caps.image) imageModel = legacyModel
      if (!textModel && legacyModel && caps.text) textModel = legacyModel
      const normalizedTextModel = normalizeOpenAITextModel(nextType, textModel)
      if (normalizedTextModel !== textModel) didMutate = true
      textModel = normalizedTextModel

      const { model: _legacyModel, ...rest } = p
      return {
        ...rest,
        type: nextType,
        imageModel,
        textModel,
        capabilities: caps
      } as Provider
    })

  if (providers.length !== rawProviders.length) didMutate = true
  return { providers, didMutate }
}

export const createProviderSlice: StateCreator<AppState, [], [], ProviderSlice> = (set, get) => {
  const scheduleWrite = (key: string, value: string) => {
    scheduleStorageWrite(key, value, () => get().showToast('浏览器存储写入失败', 'error'))
  }

  return {
    providers: [],
    activeProviderId: '',
    activeTextProviderId: '',
    initProviders: () => {
      try {
        const raw = safeStorageGet(PROVIDERS_KEY)
        const parsed = raw ? JSON.parse(raw) : []
        const rawProviders = Array.isArray(parsed) ? parsed : []
        let { providers, didMutate } = normalizeProviders(rawProviders)
        if (isW3KitsRuntime()) {
          const managed = createW3KitsProvider()
          const existingManaged = providers.find((provider) => provider.id === W3KITS_PROVIDER_ID)
          providers = [
            existingManaged
              ? { ...existingManaged, ...managed }
              : managed,
            ...providers.filter((provider) => provider.id !== W3KITS_PROVIDER_ID)
          ]
          didMutate = true
        }

        let activeId = safeStorageGet(ACTIVE_IMAGE_KEY) || ''
        let activeTextId = safeStorageGet(ACTIVE_TEXT_KEY) || ''

        // Migrate old config
        const oldHost = safeStorageGet('api-host')
        if (oldHost && providers.length === 0) {
          providers = [
            {
              id: 'legacy_' + Date.now(),
              name: '默认渠道',
              type: 'gemini',
              host: oldHost,
              key: safeStorageGet('api-key') || '',
              textModel: '',
              imageModel: safeStorageGet('model-name') || 'gemini-3-pro-image-preview',
              capabilities: { image: true, text: false }
            }
          ]
          didMutate = true
        }

        const defaultImageId = providers.find(p => p.capabilities?.image)?.id || ''
        const defaultTextId = providers.find(p => p.capabilities?.text)?.id || ''

        if (!activeId || !providers.find(p => p.id === activeId && p.capabilities?.image)) {
          activeId = defaultImageId
        }
        if (!activeTextId || !providers.find(p => p.id === activeTextId && p.capabilities?.text)) {
          activeTextId = defaultTextId
        }

        scheduleWrite(ACTIVE_IMAGE_KEY, activeId)
        scheduleWrite(ACTIVE_TEXT_KEY, activeTextId)

        if (didMutate) {
          scheduleWrite(PROVIDERS_KEY, JSON.stringify(persistableProviders(providers)))
        }

        set({ providers, activeProviderId: activeId, activeTextProviderId: activeTextId })
      } catch (e) {
        console.error('Failed to init providers:', e)
        set({ providers: [], activeProviderId: '', activeTextProviderId: '' })
        get().showToast('初始化渠道配置失败', 'error')
      }
    },
    saveProvider: (provider) => {
      const { providers } = get()
      const id = provider.id || 'p_' + Date.now()
      const caps = {
        image: provider.capabilities?.image ?? true,
        text: provider.capabilities?.text ?? false
      }
      const legacyModel = typeof (provider as any)?.model === 'string' ? (provider as any).model : ''
      const textModel = normalizeOpenAITextModel(
        provider.type,
        provider.textModel || (caps.text ? legacyModel : '') || ''
      )
      const imageModel = provider.imageModel || (caps.image ? legacyModel : '') || ''

      const { model: _legacyModel, ...rest } = provider as any
      const newProvider: Provider = {
        ...rest,
        id,
        capabilities: caps,
        textModel,
        imageModel
      }

      let newProviders: Provider[]
      const existingIndex = providers.findIndex(p => p.id === id)
      if (existingIndex > -1) {
        newProviders = [...providers]
        newProviders[existingIndex] = newProvider as Provider
      } else {
        newProviders = [...providers, newProvider as Provider]
      }

      scheduleWrite(PROVIDERS_KEY, JSON.stringify(persistableProviders(newProviders)))
      set({ providers: newProviders })
      get().showToast('渠道已保存', 'success')
      return id
    },
    deleteProvider: (id) => {
      const { providers, activeProviderId, activeTextProviderId } = get()
      const newProviders = providers.filter(p => p.id !== id)
      scheduleWrite(PROVIDERS_KEY, JSON.stringify(persistableProviders(newProviders)))

      const pickFirst = (capability: 'image' | 'text') =>
        newProviders.find(p => (capability === 'image' ? p.capabilities?.image : p.capabilities?.text))?.id || ''

      let newActiveId = activeProviderId === id ? pickFirst('image') : activeProviderId
      if (newActiveId && !newProviders.find(p => p.id === newActiveId && p.capabilities?.image)) {
        newActiveId = pickFirst('image')
      }
      scheduleWrite(ACTIVE_IMAGE_KEY, newActiveId)

      let newActiveTextId = activeTextProviderId === id ? pickFirst('text') : activeTextProviderId
      if (newActiveTextId && !newProviders.find(p => p.id === newActiveTextId && p.capabilities?.text)) {
        newActiveTextId = pickFirst('text')
      }
      scheduleWrite(ACTIVE_TEXT_KEY, newActiveTextId)

      set({ providers: newProviders, activeProviderId: newActiveId, activeTextProviderId: newActiveTextId })
      get().showToast('渠道已删除', 'success')
    },
    setActiveProvider: (id) => {
      scheduleWrite(ACTIVE_IMAGE_KEY, id)
      set({ activeProviderId: id })
    },
    setActiveTextProvider: (id) => {
      scheduleWrite(ACTIVE_TEXT_KEY, id)
      set({ activeTextProviderId: id })
    },
    getActiveConfig: (capability = 'image') => {
      const { providers, activeProviderId, activeTextProviderId } = get()
      if (providers.length === 0) return null

      const pool = providers.filter(p => capability === 'image' ? p.capabilities?.image : p.capabilities?.text)
      if (pool.length === 0) return null

      const activeId = capability === 'image' ? activeProviderId : activeTextProviderId
      return pool.find(p => p.id === activeId) || pool[0] || null
    }
  }
}

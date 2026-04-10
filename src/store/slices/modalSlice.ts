import type { StateCreator } from 'zustand'
import type { AppState } from '../appStore'

export interface ModalSlice {
  bananaModalOpen: boolean
  settingsModalOpen: boolean
  editorImageUrl: string | null
  editorInitialTab: 'slice' | 'edit'
  openBananaModal: () => void
  closeBananaModal: () => void
  openSettingsModal: () => void
  closeSettingsModal: () => void
  openImageEditor: (payload?: { imageUrl?: string; initialTab?: 'slice' | 'edit' }) => void
  closeImageEditor: () => void
}

export const createModalSlice: StateCreator<AppState, [], [], ModalSlice> = (set, get) => ({
  bananaModalOpen: false,
  settingsModalOpen: false,
  editorImageUrl: null,
  editorInitialTab: 'slice',
  openBananaModal: () => {
    get().closeAllSidebars()
    set({ bananaModalOpen: true })
  },
  closeBananaModal: () => set({ bananaModalOpen: false }),
  openSettingsModal: () => {
    get().closeAllSidebars()
    set({ settingsModalOpen: true })
  },
  closeSettingsModal: () => set({ settingsModalOpen: false }),
  openImageEditor: (payload) => {
    get().closeAllSidebars()
    set({
      editorImageUrl: payload?.imageUrl || null,
      editorInitialTab: payload?.initialTab || 'slice'
    })
  },
  closeImageEditor: () => set({ editorImageUrl: null, editorInitialTab: 'slice' })
})

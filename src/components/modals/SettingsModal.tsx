import { useAppStore } from '@/store/appStore'
import Modal from '@/components/ui/Modal'
import SettingsPanel from '@/components/settings/SettingsPanel'

export default function SettingsModal() {
  const { settingsModalOpen, closeSettingsModal } = useAppStore()

  return (
    <Modal
      isOpen={settingsModalOpen}
      onClose={closeSettingsModal}
      title="设置"
      className="w-full max-w-6xl"
    >
      <div className="p-4">
        <SettingsPanel />
      </div>
    </Modal>
  )
}

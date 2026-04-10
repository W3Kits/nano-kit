import { useEffect } from 'react'
import { usePageHeader } from '../components/layout/PageHeaderContext'
import SettingsPanel from '@/components/settings/SettingsPanel'

export default function SettingsPage() {
  const { setHeader } = usePageHeader()

  useEffect(() => {
    setHeader({
      title: '设置',
      description: 'API 渠道管理'
    })
    return () => setHeader(null)
  }, [setHeader])

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="mb-4 lg:hidden">
          <h1 className="text-lg font-semibold tracking-tight">设置</h1>
          <p className="text-xs text-[var(--text-tertiary)] mt-1 font-serif">API 渠道管理</p>
        </div>
        <SettingsPanel />
      </div>
    </div>
  )
}

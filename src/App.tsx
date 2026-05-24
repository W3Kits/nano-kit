import { useEffect } from 'react'
import { useAppStore } from './store/appStore'
import Layout from './components/Layout'
import Toast from './components/ui/Toast'
import Lightbox from './components/ui/Lightbox'
import GlobalLoading from './components/ui/GlobalLoading'
import { hydratePersistentStorage } from './store/utils/storage'

function App() {
  const { theme, initTheme, initProviders, initDB } = useAppStore()

  useEffect(() => {
    const updateAppHeight = () => {
      const height = window.visualViewport?.height ?? window.innerHeight
      document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`)
    }

    updateAppHeight()

    window.addEventListener('resize', updateAppHeight)
    window.visualViewport?.addEventListener('resize', updateAppHeight)
    window.visualViewport?.addEventListener('scroll', updateAppHeight)
    return () => {
      window.removeEventListener('resize', updateAppHeight)
      window.visualViewport?.removeEventListener('resize', updateAppHeight)
      window.visualViewport?.removeEventListener('scroll', updateAppHeight)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      await hydratePersistentStorage().catch(() => undefined)
      initTheme()
      initProviders()
      await initDB()
    })()
  }, [initDB, initProviders, initTheme])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <div className="h-[var(--app-height)] w-screen overflow-hidden">
      <Layout />
      <Toast />
      <Lightbox />
      <GlobalLoading />
    </div>
  )
}

export default App

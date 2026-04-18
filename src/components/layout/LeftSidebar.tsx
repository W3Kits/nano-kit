import { NavLink } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'

export default function LeftSidebar() {
  const {
    leftSidebarOpen,
    leftSidebarCollapsed,
    toggleLeftSidebarCollapsed,
    closeAllSidebars,
    openSettingsModal
  } = useAppStore()

  return (
    <>
      {/* Mobile overlay */}
      {leftSidebarOpen && (
        <div
          className="fixed inset-0 bg-[rgba(20,20,19,0.45)] backdrop-blur-sm z-40 lg:hidden"
          onClick={closeAllSidebars}
        />
      )}

      <nav className={`
        fixed lg:relative top-0 left-0 h-full w-72 ${leftSidebarCollapsed ? 'lg:w-20' : 'lg:w-72'} bg-[var(--bg-secondary)] border-r border-[var(--border-color)]
        flex flex-col z-50 transition-[transform,width] duration-300
        ${leftSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className={`px-4 pt-4 pb-3 border-b border-[var(--border-color)] ${leftSidebarCollapsed ? 'lg:px-3' : ''}`}>
          <div className={`flex items-center gap-3 px-2 py-2.5 ${leftSidebarCollapsed ? 'lg:justify-center lg:px-0' : ''}`}>
            <div className="w-10 h-10 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] flex items-center justify-center">
              <img src="/logo.png" alt="logo" className="w-6 h-6 object-contain" />
            </div>
            <div className={`leading-tight min-w-0 ${leftSidebarCollapsed ? 'lg:hidden' : ''}`}>
              <div className="font-semibold text-sm truncate lowercase tracking-tight">nano kit</div>
              <div className="text-xs text-[var(--text-tertiary)] truncate font-serif">Nano Banana Pro 灵感工具箱</div>
            </div>
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto px-3 py-3 space-y-5 ${leftSidebarCollapsed ? 'lg:px-2' : ''}`}>
          {/* Creation tools */}
          <div>
            <div className={`text-xs text-[var(--text-tertiary)] font-medium mb-2 px-2 ${leftSidebarCollapsed ? 'lg:hidden' : ''}`}>创作工具</div>
            <div className="space-y-1">
              <NavCard
                to="/"
                icon={<ImageIcon />}
                title="生成图片"
                desc="自定义生图"
                color="text-[var(--accent-color)]"
                onNavigate={closeAllSidebars}
                collapsed={leftSidebarCollapsed}
              />
              <NavCard
                to="/article-images"
                icon={<ArticleIcon />}
                title="文章配图"
                desc="为文章生成封面以及配图"
                color="text-[var(--link-color)]"
                onNavigate={closeAllSidebars}
                collapsed={leftSidebarCollapsed}
              />
              <NavCard
                to="/xhs-images"
                icon={<XHSIcon />}
                title="XHS配图"
                desc="拆解内容为小红书图文卡片"
                color="text-[var(--link-color)]"
                onNavigate={closeAllSidebars}
                collapsed={leftSidebarCollapsed}
              />
              <NavCard
                to="/infographic"
                icon={<ChartIcon />}
                title="信息图"
                desc="单页高密度信息图"
                color="text-[var(--link-color)]"
                onNavigate={closeAllSidebars}
                collapsed={leftSidebarCollapsed}
              />
              <NavCard
                to="/prompts"
                icon={<BookmarkIcon />}
                title="我的提示词"
                desc="收藏的提示词"
                color="text-[var(--link-color)]"
                onNavigate={closeAllSidebars}
                collapsed={leftSidebarCollapsed}
              />
              <NavCard
                to="/editor"
                icon={<SliceIcon />}
                title="图片编辑"
                desc="局部编辑/切片"
                color="text-[var(--text-secondary)]"
                onNavigate={closeAllSidebars}
                collapsed={leftSidebarCollapsed}
              />
            </div>
          </div>

          {/* Settings & management */}
          <div>
            <div className={`text-xs text-[var(--text-tertiary)] font-medium mb-2 px-2 ${leftSidebarCollapsed ? 'lg:hidden' : ''}`}>设置与管理</div>
            <div className="space-y-1">
              <NavCard
                to="/records"
                icon={<GridIcon />}
                title="作品管理"
                desc="浏览与管理作品"
                color="text-[var(--success-color)]"
                onNavigate={closeAllSidebars}
                collapsed={leftSidebarCollapsed}
              />
              <ActionCard
                icon={<GearIcon />}
                title="设置"
                desc="API管理"
                color="text-[var(--text-secondary)]"
                collapsed={leftSidebarCollapsed}
                onClick={() => {
                  closeAllSidebars()
                  openSettingsModal()
                }}
              />
            </div>
          </div>
        </div>

        <div className="hidden lg:block px-3 py-3 border-t border-[var(--border-color)]">
          <button
            type="button"
            onClick={toggleLeftSidebarCollapsed}
            className={`w-full px-3 py-2.5 rounded-xl border border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors ${leftSidebarCollapsed ? 'flex items-center justify-center' : 'flex items-center gap-3 text-left'}`}
            aria-label={leftSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
            title={leftSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            <div className={`shrink-0 transition-transform ${leftSidebarCollapsed ? '' : 'rotate-180'}`}>
              <SidebarToggleIcon />
            </div>
            <span className={leftSidebarCollapsed ? 'sr-only' : 'text-sm font-medium'}>
              {leftSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
            </span>
          </button>
        </div>
      </nav>
    </>
  )
}

function ActionCard({ icon, title, desc, onClick, color, collapsed }: {
  icon: React.ReactNode
  title: string
  desc: string
  onClick: () => void
  color: string
  collapsed?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-3 py-2.5 rounded-xl cursor-pointer flex items-center gap-3 transition-colors border border-transparent hover:bg-[var(--bg-tertiary)] text-left ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
      aria-label={title}
      title={collapsed ? title : undefined}
    >
      <div className={color}>{icon}</div>
      <div className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
        <div className="text-sm font-medium truncate">{title}</div>
        <div className="text-xs text-[var(--text-tertiary)] truncate">{desc}</div>
      </div>
    </button>
  )
}

function NavCard({ to, icon, title, desc, onNavigate, color, collapsed }: {
  to: string
  icon: React.ReactNode
  title: string
  desc: string
  onNavigate: () => void
  color: string
  collapsed?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onNavigate}
      aria-label={title}
      title={collapsed ? title : undefined}
      className={({ isActive }) => `
        px-3 py-2.5 rounded-xl cursor-pointer flex items-center gap-3 transition-colors border border-transparent
        ${collapsed ? 'lg:justify-center lg:px-0' : ''}
        ${isActive
          ? 'bg-[var(--bg-primary)] border-[var(--border-color)] shadow-sm'
          : 'hover:bg-[var(--bg-tertiary)]'
        }
      `}
    >
      <div className={color}>{icon}</div>
      <div className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
        <div className="text-sm font-medium truncate">{title}</div>
        <div className="text-xs text-[var(--text-tertiary)] truncate">{desc}</div>
      </div>
    </NavLink>
  )
}

// Icons
function ImageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

function ArticleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="14" y2="17" />
    </svg>
  )
}

function XHSIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="6" height="14" rx="1.5" />
      <rect x="10" y="5" width="4" height="14" rx="1.5" />
      <rect x="15" y="5" width="6" height="14" rx="1.5" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="4" y1="19" x2="20" y2="19" />
      <rect x="6" y="10" width="3" height="7" />
      <rect x="11" y="6" width="3" height="11" />
      <rect x="16" y="13" width="3" height="4" />
    </svg>
  )
}

function BookmarkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function SliceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 3L6 21" />
      <path d="M18 3L18 21" />
      <path d="M2 12L22 12" />
    </svg>
  )
}

function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function SidebarToggleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

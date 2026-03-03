import { clsx } from 'clsx'

export function Layout({ sidebar, header, children, collapsed, onToggleSidebar }) {
  return (
    <div className="flex h-screen bg-canvas overflow-hidden">
      {/* Sidebar + toggle button wrapper */}
      <div className="relative flex-none group/sidebar h-screen">
        <aside
          className={clsx(
            'h-full border-r border-wire bg-lift flex flex-col transition-[width] duration-200 ease-in-out overflow-hidden',
            collapsed ? 'w-[52px]' : 'w-60'
          )}
        >
          {sidebar}
        </aside>

        {/* Toggle button — floats on the right border, appears on sidebar hover */}
        <button
          onClick={onToggleSidebar}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute top-[22px] right-0 translate-x-1/2 z-30 w-5 h-5 rounded-full bg-lift border border-wire flex items-center justify-center text-ink-low hover:text-ink hover:bg-float shadow-sm transition-all opacity-0 group-hover/sidebar:opacity-100"
        >
          <svg
            className={clsx(
              'w-2.5 h-2.5 transition-transform duration-200',
              collapsed ? 'rotate-180' : ''
            )}
            viewBox="0 0 10 10" fill="none"
          >
            <path
              d="M6.5 2L3.5 5l3 3"
              stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {header}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
          {children}
        </div>
      </main>
    </div>
  )
}

import { useRef, useCallback } from 'react'
import { clsx } from 'clsx'

export function Layout({ sidebar, header, children, collapsed, onToggleSidebar, sidebarWidth, onResize, onResizeEnd, onCollapse, onExpand }) {
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  const handleDragStart = useCallback((e) => {
    e.preventDefault()
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = collapsed ? 52 : sidebarWidth

    const onMove = (e) => {
      if (!isDragging.current) return
      const delta = e.clientX - dragStartX.current
      const newWidth = dragStartWidth.current + delta

      if (collapsed) {
        if (newWidth > 180) {
          onExpand(Math.min(newWidth, 400))
        }
      } else {
        if (newWidth < 180) {
          onCollapse()
          isDragging.current = false
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
        } else {
          onResize(Math.min(newWidth, 400))
        }
      }
    }

    const onUp = () => {
      if (isDragging.current) {
        isDragging.current = false
        onResizeEnd(Math.min(Math.max(sidebarWidth, 180), 400))
      }
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [collapsed, sidebarWidth, onResize, onResizeEnd, onCollapse, onExpand])

  return (
    <div className="flex h-screen bg-canvas overflow-hidden">
      {/* Sidebar + toggle button wrapper */}
      <div className="relative flex-none group/sidebar h-screen">
        <aside
          className="h-full border-r border-wire bg-lift flex flex-col transition-[width] duration-200 ease-in-out overflow-hidden"
          style={{ width: collapsed ? 52 : sidebarWidth }}
        >
          {sidebar}
        </aside>

        {/* Resize handle — invisible, sits on the right border */}
        <div
          onMouseDown={handleDragStart}
          className="absolute inset-y-0 right-0 w-1 cursor-ew-resize z-20 hover:bg-brand/20 transition-colors"
          title="Drag to resize"
        />

        {/* Toggle button — floats on the right border, appears on sidebar hover */}
        <button
          onClick={onToggleSidebar}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute top-[22px] right-0 translate-x-1/2 z-30 w-5 h-5 rounded-full bg-lift border border-wire flex items-center justify-center text-ink-low hover:text-ink hover:bg-float shadow-sm transition-all opacity-30 hover:opacity-100"
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

import { useRef, useCallback, useState } from 'react'
import { clsx } from 'clsx'

const COLLAPSED_WIDTH = 52
const MIN_WIDTH = 180
const MAX_WIDTH = 400

export function Layout({ sidebar, header, children, sidebarWidth, onToggleSidebar, onResize, onResizeEnd }) {
  const isCollapsed = sidebarWidth === COLLAPSED_WIDTH
  const [dragging, setDragging] = useState(false)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)
  const lastWidth = useRef(0)

  const handleDragStart = useCallback((e) => {
    e.preventDefault()
    setDragging(true)
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = sidebarWidth
    lastWidth.current = sidebarWidth

    const onMove = (e) => {
      if (!isDragging.current) return
      const raw = dragStartWidth.current + (e.clientX - dragStartX.current)
      // Drag clamps between MIN_WIDTH and MAX_WIDTH — never touches ribbon
      const w = Math.min(Math.max(raw, MIN_WIDTH), MAX_WIDTH)
      lastWidth.current = w
      onResize(w)
    }

    const onUp = () => {
      if (isDragging.current) {
        setDragging(false)
        isDragging.current = false
        onResizeEnd(lastWidth.current)
      }
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [sidebarWidth, onResize, onResizeEnd])

  return (
    <div className="flex h-screen bg-canvas overflow-hidden">
      {/* Sidebar + toggle button wrapper */}
      <div className="relative flex-none h-screen">
        <aside
          className={clsx(
            'h-full border-r border-wire bg-lift flex flex-col overflow-hidden',
            !dragging && 'transition-[width] duration-200 ease-in-out'
          )}
          style={{ width: sidebarWidth }}
        >
          {sidebar}
        </aside>

        {/* Resize handle — invisible drag zone on the right border, only active when not collapsed */}
        {!isCollapsed && (
          <div
            onMouseDown={handleDragStart}
            className="absolute inset-y-0 right-0 w-1 cursor-ew-resize z-20 hover:bg-brand/20 transition-colors"
            title="Drag to resize"
          />
        )}

        {/* Toggle button — always visible but discrete */}
        <button
          onClick={onToggleSidebar}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute top-[22px] right-0 translate-x-1/2 z-30 w-5 h-5 rounded-full bg-lift border border-wire flex items-center justify-center text-ink-low hover:text-ink hover:bg-float shadow-sm transition-all opacity-30 hover:opacity-100"
        >
          <svg
            className={clsx(
              'w-2.5 h-2.5 transition-transform duration-200',
              isCollapsed ? 'rotate-180' : ''
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

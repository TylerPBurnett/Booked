export function Layout({ sidebar, header, children }) {
  return (
    <div className="flex h-screen bg-canvas overflow-hidden">
      <aside className="w-60 shrink-0 border-r border-wire bg-lift flex flex-col overflow-hidden">
        {sidebar}
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {header}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
          {children}
        </div>
      </main>
    </div>
  )
}

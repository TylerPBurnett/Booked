export function Layout({ sidebar, header, children }) {
  return (
    <div className="flex h-screen bg-neutral-950 overflow-hidden">
      <aside className="w-56 shrink-0 border-r border-neutral-800 flex flex-col overflow-y-auto scrollbar-thin">
        {sidebar}
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">
        {header}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
          {children}
        </div>
      </main>
    </div>
  )
}

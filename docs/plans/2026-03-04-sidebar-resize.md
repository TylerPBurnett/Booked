# Sidebar Resize + Discrete Toggle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the sidebar resizable by dragging its right border, and make the hide/show toggle always visible but discrete.

**Architecture:** All drag state lives in Layout.jsx via refs (no re-renders during drag). Width state lives in App.jsx and is passed down. Collapsing/expanding during drag calls the existing toggle mechanism so collapsed-state localStorage stays in sync.

**Tech Stack:** React 18, Vite, Tailwind v3, clsx

---

### Task 1: Add sidebarWidth state to App.jsx

**Files:**
- Modify: `client/src/App.jsx`

**Step 1: Read the current App.jsx**

Read `client/src/App.jsx` fully before editing.

**Step 2: Add sidebarWidth state and handlers**

Find the `sidebarCollapsed` state block (around line 19) and add after it:

```jsx
const [sidebarWidth, setSidebarWidth] = useState(() => {
  try { return Number(localStorage.getItem('booked-sidebar-width')) || 240 } catch { return 240 }
})

const handleResize = (w) => setSidebarWidth(w)

const handleResizeEnd = (w) => {
  try { localStorage.setItem('booked-sidebar-width', String(w)) } catch {}
}

const handleExpand = (w) => {
  setSidebarCollapsed(false)
  setSidebarWidth(w)
  try {
    localStorage.setItem('booked-sidebar-collapsed', 'false')
    localStorage.setItem('booked-sidebar-width', String(w))
  } catch {}
}
```

Note: `handleCollapse` is just `toggleSidebar` — reuse that, don't add a duplicate.

**Step 3: Pass new props to Layout**

Find the `<Layout` JSX (around line 51). Add these props:

```jsx
<Layout
  collapsed={sidebarCollapsed}
  onToggleSidebar={toggleSidebar}
  sidebarWidth={sidebarWidth}
  onResize={handleResize}
  onResizeEnd={handleResizeEnd}
  onCollapse={toggleSidebar}
  onExpand={handleExpand}
  sidebar={...}
  ...
>
```

**Step 4: Verify no runtime errors**

Open browser at `http://localhost:5173`. Sidebar should look and behave identically to before. Check console for errors.

**Step 5: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat: add sidebarWidth state + resize handlers to App"
```

---

### Task 2: Update Layout.jsx — always-visible toggle + width via inline style

**Files:**
- Modify: `client/src/components/Layout.jsx`

**Step 1: Read the current Layout.jsx**

Read `client/src/components/Layout.jsx` fully before editing.

**Step 2: Accept new props**

Update the function signature:

```jsx
export function Layout({ sidebar, header, children, collapsed, onToggleSidebar, sidebarWidth, onResize, onResizeEnd, onCollapse, onExpand }) {
```

**Step 3: Replace Tailwind width classes with inline style**

Find the `<aside` element. Change:

```jsx
className={clsx(
  'h-full border-r border-wire bg-lift flex flex-col transition-[width] duration-200 ease-in-out overflow-hidden',
  collapsed ? 'w-[52px]' : 'w-60'
)}
```

To:

```jsx
className="h-full border-r border-wire bg-lift flex flex-col transition-[width] duration-200 ease-in-out overflow-hidden"
style={{ width: collapsed ? 52 : sidebarWidth }}
```

**Step 4: Make toggle button always visible but discrete**

Find the toggle `<button>`. Change the className from:

```
opacity-0 group-hover/sidebar:opacity-100
```

To:

```
opacity-30 hover:opacity-100
```

The full button className becomes:

```jsx
className="absolute top-[22px] right-0 translate-x-1/2 z-30 w-5 h-5 rounded-full bg-lift border border-wire flex items-center justify-center text-ink-low hover:text-ink hover:bg-float shadow-sm transition-all opacity-30 hover:opacity-100"
```

**Step 5: Verify in browser**

- Toggle button should now be faintly visible at all times (not just on hover)
- Sidebar width should still animate on collapse/expand
- No visual regressions

**Step 6: Commit**

```bash
git add client/src/components/Layout.jsx
git commit -m "feat: discrete always-visible toggle + inline sidebar width"
```

---

### Task 3: Add drag-to-resize handle to Layout.jsx

**Files:**
- Modify: `client/src/components/Layout.jsx`

**Step 1: Add imports**

Add to the top of Layout.jsx:

```jsx
import { useRef, useCallback, useEffect } from 'react'
```

**Step 2: Add drag refs inside the Layout function body**

Add these before the return statement:

```jsx
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
      // dragging right from collapsed — expand when past threshold
      if (newWidth > 180) {
        onExpand(Math.min(newWidth, 400))
      }
    } else {
      if (newWidth < 180) {
        // collapse when dragged below threshold
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
```

**Step 3: Add the drag handle div**

Inside the `<div className="relative flex-none group/sidebar h-screen">` wrapper, after the `<aside>` closing tag and before the toggle `<button>`, add:

```jsx
{/* Resize handle — invisible, sits on the right border */}
<div
  onMouseDown={handleDragStart}
  className="absolute inset-y-0 right-0 w-1 cursor-ew-resize z-20 hover:bg-brand/20 transition-colors"
  title="Drag to resize"
/>
```

**Step 4: Verify drag behavior**

Manual test checklist:
- [ ] Drag border right → sidebar gets wider (up to 400px)
- [ ] Drag border left past 180px → sidebar collapses
- [ ] While collapsed, drag border right past 180px → sidebar expands
- [ ] Width is saved after releasing drag (refresh page — width persists)
- [ ] Cursor changes to `ew-resize` on hover over border
- [ ] Text selection is not triggered during drag
- [ ] Toggle button still works normally

**Step 5: Commit**

```bash
git add client/src/components/Layout.jsx
git commit -m "feat: drag-to-resize sidebar with collapse/expand snap"
```

---

### Task 4: Disable width transition during active drag

**Files:**
- Modify: `client/src/components/Layout.jsx`

The `transition-[width]` class on `<aside>` causes lag during drag. It should only be active when not dragging (i.e. for the toggle animation).

**Step 1: Add isDraggingState for render**

Add a state variable (separate from the ref, which is for the drag logic):

```jsx
const [dragging, setDragging] = useState(false)
```

Add `useState` to the existing React import.

**Step 2: Set dragging state in handleDragStart**

At the top of `handleDragStart`, add:

```jsx
setDragging(true)
```

In the `onUp` handler, add:

```jsx
setDragging(false)
```

**Step 3: Conditionally apply transition class**

Update the `<aside>` className:

```jsx
className={clsx(
  'h-full border-r border-wire bg-lift flex flex-col overflow-hidden',
  !dragging && 'transition-[width] duration-200 ease-in-out'
)}
```

**Step 4: Verify**

- Dragging should now feel instant/direct with no lag
- Toggle collapse/expand still animates smoothly

**Step 5: Commit**

```bash
git add client/src/components/Layout.jsx
git commit -m "fix: disable width transition during drag for responsive feel"
```

---

### Task 5: Final verification + cleanup

**Step 1: Full manual test**

- [ ] Fresh page load — sidebar width matches last saved value
- [ ] Drag to resize smoothly, no lag
- [ ] Drag below threshold → collapses
- [ ] Drag from collapsed past threshold → expands
- [ ] Width persists after refresh
- [ ] Collapsed state persists after refresh
- [ ] Toggle button visible at rest (faint), bright on hover
- [ ] Toggle button still works (click to collapse/expand)
- [ ] No console errors

**Step 2: Check for any stale `w-60` or `w-[52px]` classes**

```bash
grep -n 'w-60\|w-\[52px\]' client/src/components/Layout.jsx
```

Expected: no matches (these should be replaced by inline style).

**Step 3: Final commit if any cleanup needed**

```bash
git add -p
git commit -m "chore: sidebar resize cleanup"
```

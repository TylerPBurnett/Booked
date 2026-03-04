# Sidebar Resize + Discrete Toggle — Design

**Date:** 2026-03-04
**Branch:** feat/sidebar-redesign

## Goal

Make the sidebar resizable by dragging its right border, and make the hide/show toggle always visible but discrete.

## Behavior

### Resize
- Drag the sidebar's right border left/right to resize
- Dragging below 180px threshold → auto-collapse (snap to 52px)
- While collapsed, dragging right past 180px → re-expand (snap to 180px or last saved width, whichever is wider)
- Max width: 400px
- No hard minimum clamp — collapse is the floor

### Toggle Button
- Always visible at `opacity-30`, `hover:opacity-100`
- Removes the existing `opacity-0 group-hover/sidebar:opacity-100` pattern
- Position unchanged: floats at the right border, top of sidebar

### Persistence
- `sidebarWidth` stored in `localStorage` key `booked-sidebar-width`, default 240
- Saved on drag end (mouseup), not on every mousemove
- Collapsed state continues to use existing `booked-sidebar-collapsed` key

## Implementation

### Files changed
- `client/src/App.jsx` — add `sidebarWidth` state + localStorage persistence, pass `onResize`/`onResizeEnd`/`sidebarWidth` to `Layout`
- `client/src/components/Layout.jsx` — add drag handle overlay, drag logic, always-visible toggle

### Layout.jsx changes
- Replace Tailwind width classes on `<aside>` with `style={{ width: collapsed ? 52 : sidebarWidth }}`
- Add 8px invisible overlay div on the right border: `absolute right-0 inset-y-0 w-2 cursor-ew-resize z-20`
- `onMouseDown` → attach `mousemove`/`mouseup` to `window`
- During drag: update width live via `onResize(newWidth)`, add `select-none` + disable width transition
- On `mousemove`: if `!collapsed && newWidth < 180` → call `onCollapse()`; if `collapsed && newWidth > 180` → call `onExpand(newWidth)`
- `onMouseUp` → detach listeners, call `onResizeEnd()` to persist

### App.jsx changes
- `sidebarWidth` state initialized from localStorage, default 240
- Pass to Layout: `sidebarWidth`, `onResize={w => setSidebarWidth(w)}`, `onResizeEnd={() => localStorage.setItem(...)}`, `onCollapse={...}`, `onExpand={w => { setSidebarWidth(w); setSidebarCollapsed(false) }}`

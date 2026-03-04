# Sidebar Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Modernize the sidebar with Raindrop-style hover menus, category icon/color customization, animated expand/collapse, better visual hierarchy, and theme picker relocated to the TopBar.

**Architecture:** Extend the flat-file category model (`{ name, children }` → `{ name, children, icon, color }`) with a new PATCH field. Rework `Sidebar.jsx` CategoryRow to swap count↔menu on hover. Extract ThemePicker into TopBar. All changes are additive — no breaking API changes.

**Tech Stack:** React 18, Tailwind v3, Express, clsx, @dnd-kit, flat JSON file storage.

---

### Task 1: Extend data model — add `icon` and `color` to categories

**Files:**
- Modify: `server/data.js` — `migrateMeta()` to backfill `icon: null, color: null`
- Modify: `server/routes/categories.js` — PATCH endpoint accepts `icon`, `color`
- Modify: `client/src/hooks/useCategories.js` — add `updateCategory(name, patch)` method

**Step 1: Update `migrateMeta()` in `server/data.js`**

In the migration function, after converting old flat strings to `{ name, children }` objects, ensure every category object also has `icon` and `color` keys (default `null`):

```js
// Inside migrateMeta, after existing migration logic:
if (meta.categories) {
  meta.categories = meta.categories.map(c => ({
    ...c,
    icon: c.icon ?? null,
    color: c.color ?? null,
  }))
}
```

**Step 2: Extend PATCH route in `server/routes/categories.js`**

The current PATCH only handles `{ name, parent }` for renames. Extend it to also accept `icon` and `color`. When those fields are present (and `name` is absent or unchanged), just update the category object in meta without cascading bookmark renames.

```js
// In PATCH handler, after extracting body:
const { name: newName, parent, icon, color } = req.body

// If only icon/color update (no rename):
if ((icon !== undefined || color !== undefined) && (!newName || newName === req.params.name)) {
  const cat = meta.categories.find(c => c.name === req.params.name)
  if (!cat) return res.status(404).json({ error: 'Category not found' })
  if (icon !== undefined) cat.icon = icon
  if (color !== undefined) cat.color = color
  writeMeta(meta)
  return res.json({ ok: true })
}
// ...existing rename logic continues
```

**Step 3: Add `updateCategory` to `useCategories.js`**

```js
const updateCategory = useCallback(async (name, patch) => {
  const res = await fetch(`/api/categories/${encodeURIComponent(name)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error((await res.json()).error)
  await fetch_()
}, [fetch_])
```

Return it from the hook alongside existing methods.

**Step 4: Verify**

Start the dev server. Open browser devtools network tab. Call the PATCH endpoint manually or via the hook — confirm `icon` and `color` persist in `data/meta.json`.

**Step 5: Commit**

```
feat: extend category model with icon and color fields
```

---

### Task 2: Raindrop-style count/menu swap on CategoryRow

**Files:**
- Modify: `client/src/components/Sidebar.jsx` — rework `CategoryRow` right-side area

**Step 1: Add a `CategoryMenu` dropdown component inside Sidebar.jsx**

This is a small positioned dropdown that appears when the 3-dot button is clicked. It renders:
- Rename (pencil icon)
- Add subcategory (plus icon) — only for depth=0
- Change icon (emoji icon)
- Change color (palette icon)
- Divider
- Delete (red, trash icon)

Use a `useRef` + `useEffect` click-outside listener to close. Position it below the 3-dot button using `absolute` positioning relative to the row.

```jsx
function CategoryMenu({ onRename, onAddSub, onChangeIcon, onChangeColor, onDelete, onClose, depth }) {
  const ref = useRef(null)
  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-50 bg-lift border border-wire rounded-xl shadow-xl py-1 min-w-[160px]">
      <MenuButton icon={pencilSvg} label="Rename" onClick={() => { onRename(); onClose() }} />
      {depth === 0 && <MenuButton icon={plusSvg} label="Add subcategory" onClick={() => { onAddSub(); onClose() }} />}
      <MenuButton icon={emojiSvg} label="Change icon" onClick={() => { onChangeIcon(); onClose() }} />
      <MenuButton icon={paletteSvg} label="Change color" onClick={() => { onChangeColor(); onClose() }} />
      <div className="border-t border-wire-dim mx-2 my-0.5" />
      <MenuButton icon={trashSvg} label="Delete" danger onClick={() => { onDelete(); onClose() }} />
    </div>
  )
}
```

**Step 2: Modify the right side of `CategoryRow`**

Replace the static count display with a container that swaps count↔menu button on hover:

```jsx
{!sidebarCollapsed && !isProtected && (
  <div className="relative ml-auto shrink-0 flex items-center">
    {/* Count — visible by default, hidden on row hover */}
    <span className={clsx(
      'text-xs tabular-nums font-mono transition-opacity duration-100',
      'group-hover/row:opacity-0',
      active ? 'text-brand' : 'text-ink-low'
    )}>
      {count}
    </span>
    {/* 3-dot button — hidden by default, visible on row hover */}
    <button
      onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o) }}
      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity duration-100 text-ink-low hover:text-ink"
    >
      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
        <circle cx="8" cy="3" r="1.5"/>
        <circle cx="8" cy="8" r="1.5"/>
        <circle cx="8" cy="13" r="1.5"/>
      </svg>
    </button>
    {menuOpen && <CategoryMenu ... />}
  </div>
)}
{/* Protected rows (All, Uncategorized) still show plain count */}
{!sidebarCollapsed && isProtected && (
  <span className={clsx('text-xs ml-auto shrink-0 tabular-nums font-mono', active ? 'text-brand' : 'text-ink-low')}>
    {count}
  </span>
)}
```

**Step 3: Remove old right-click context menu system**

Delete the `ctxMenu` state, the `handleCtxMenu` callback, the `onCtxMenu` prop threading, and the fixed-position context menu div at the bottom of Sidebar. All actions now go through the 3-dot dropdown.

**Step 4: Verify**

Hover over categories — count should fade, 3-dot should appear. Click 3-dot — menu appears. Click outside — menu closes. Rename and Delete work. "All" and "Uncategorized" just show counts.

**Step 5: Commit**

```
feat: Raindrop-style count/menu swap on category rows
```

---

### Task 3: Emoji icon picker

**Files:**
- Modify: `client/src/components/Sidebar.jsx` — add `EmojiPicker` component, wire to CategoryMenu

**Step 1: Create a compact `EmojiPicker` component**

A small grid of ~40 common category emojis (folders, stars, hearts, tools, etc.) plus a "Reset" option to go back to the default folder icon. Renders as a positioned popover from the CategoryRow.

```jsx
const CATEGORY_EMOJIS = [
  '📁', '📂', '⭐', '❤️', '🔥', '💡', '🎯', '🚀',
  '💻', '🎨', '📝', '📚', '🔧', '🎵', '📷', '🌍',
  '💰', '🏠', '🎮', '📱', '🔒', '✅', '📌', '💬',
  '🧪', '📊', '🗂️', '💼', '🎁', '🔗', '📖', '✨',
]

function EmojiPicker({ onSelect, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-50 bg-lift border border-wire rounded-xl shadow-xl p-2 w-[220px]">
      <div className="grid grid-cols-8 gap-1">
        {CATEGORY_EMOJIS.map(emoji => (
          <button key={emoji} onClick={() => onSelect(emoji)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-float text-sm">
            {emoji}
          </button>
        ))}
      </div>
      <button onClick={() => onSelect(null)}
        className="w-full mt-1.5 text-xs text-ink-low hover:text-ink-mid py-1 rounded hover:bg-float">
        Reset to default
      </button>
    </div>
  )
}
```

**Step 2: Wire into CategoryRow**

Add `[emojiPickerOpen, setEmojiPickerOpen]` state. When "Change icon" is selected from CategoryMenu, set it to true. On select, call `onUpdateCategory(name, { icon: emoji })`. Show the emoji as the category icon when set:

```jsx
// In getCategoryIcon or inline in CategoryRow:
if (cat.icon) return <span className="w-4 h-4 flex items-center justify-center text-sm">{cat.icon}</span>
```

**Step 3: Thread `onUpdateCategory` prop**

Add `onUpdateCategory` prop to `Sidebar`, pass from App.jsx using the new `updateCategory` from useCategories. Thread it through CategoryRow.

**Step 4: Verify**

Click 3-dot → Change icon → pick emoji → icon updates. Pick "Reset" → reverts to folder SVG. Persists on page reload.

**Step 5: Commit**

```
feat: emoji icon picker for categories
```

---

### Task 4: Color picker for categories

**Files:**
- Modify: `client/src/components/Sidebar.jsx` — add `ColorPicker` component, wire to CategoryMenu

**Step 1: Create `ColorPicker` component**

A small swatch grid of 8-10 curated colors plus "Reset":

```jsx
const CATEGORY_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#6b7280', '#a3a3a3',
]

function ColorPicker({ onSelect, currentColor, onClose }) {
  // Similar click-outside pattern as EmojiPicker
  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-50 bg-lift border border-wire rounded-xl shadow-xl p-2">
      <div className="flex gap-1.5 flex-wrap">
        {CATEGORY_COLORS.map(color => (
          <button key={color} onClick={() => onSelect(color)}
            className={clsx('w-5 h-5 rounded-full border-2 transition-transform hover:scale-110',
              currentColor === color ? 'border-ink scale-110' : 'border-transparent'
            )}
            style={{ background: color }}
          />
        ))}
      </div>
      <button onClick={() => onSelect(null)}
        className="w-full mt-1.5 text-xs text-ink-low hover:text-ink-mid py-1 rounded hover:bg-float">
        Reset
      </button>
    </div>
  )
}
```

**Step 2: Apply color to category row**

When a category has a `color`, use it as the icon color (or as a left-side dot/bar):

```jsx
// Category icon gets colored:
<span className="shrink-0" style={cat.color ? { color: cat.color } : undefined}>
  {getCategoryIcon(cat)}
</span>
```

**Step 3: Wire into CategoryRow same pattern as emoji picker**

**Step 4: Verify**

Pick a color → icon/emoji gets tinted. Reset → back to default theme color. Persists.

**Step 5: Commit**

```
feat: color picker for categories
```

---

### Task 5: Better visual hierarchy — section headers with inline add button

**Files:**
- Modify: `client/src/components/Sidebar.jsx` — rework section headers and remove standalone "Add category" button

**Step 1: Replace "Library" header + "Add category" button**

Current: a `<p>` text label for "Library" and a separate full-width "Add category" button at the bottom of the category list.

New: The section header has the label on the left and a small `+` icon button on the right. Clicking `+` shows the inline AddInput at the bottom of the category list (same behavior, just different trigger).

```jsx
<div className="flex items-center justify-between px-2.5 mb-2 pt-1">
  <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-low">Library</p>
  <button
    onClick={() => setAddingTop(true)}
    className="p-0.5 rounded text-ink-low hover:text-ink-mid hover:bg-float transition-colors"
    title="Add category"
  >
    <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  </button>
</div>
```

**Step 2: Remove the old standalone "Add category" button row below Uncategorized**

Delete the `addingTop ? <AddInput> : <button>Add category</button>` block. The `AddInput` now renders at the bottom of the category list only when `addingTop` is true (triggered by the `+` in the header).

**Step 3: Tags section header — same pattern**

"Tags" label stays as-is (no add button needed for tags).

**Step 4: Verify**

Click `+` in header → inline input appears at bottom of category list. Escape or add → input disappears.

**Step 5: Commit**

```
feat: cleaner section headers with inline add button
```

---

### Task 6: Animated expand/collapse for subcategory trees

**Files:**
- Modify: `client/src/components/Sidebar.jsx` — wrap subcategory container in animated height wrapper

**Step 1: Create `AnimatedCollapse` wrapper**

A small component that animates max-height on mount/unmount:

```jsx
function AnimatedCollapse({ open, children }) {
  const ref = useRef(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (ref.current) setHeight(ref.current.scrollHeight)
  })

  return (
    <div
      style={{ maxHeight: open ? height : 0 }}
      className="overflow-hidden transition-[max-height] duration-150 ease-out"
    >
      <div ref={ref}>{children}</div>
    </div>
  )
}
```

**Step 2: Wrap subcategory tree**

Replace the conditional `{expandedCats[cat.name] && (<div>...subcategories...</div>)}` with:

```jsx
<AnimatedCollapse open={expandedCats[cat.name]}>
  <div className="ml-[22px] pl-3 border-l border-wire-dim space-y-0.5 pt-0.5 pb-1">
    {cat.children.map(sub => ...)}
    {/* Add subcategory input/button */}
  </div>
</AnimatedCollapse>
```

The subcategories always render (for measurement), but height is 0 when collapsed.

**Step 3: Verify**

Toggle expand on a category with subcategories. Should smoothly animate open/closed.

**Step 4: Commit**

```
feat: animated expand/collapse for subcategory trees
```

---

### Task 7: Move ThemePicker to TopBar

**Files:**
- Modify: `client/src/components/Sidebar.jsx` — remove ThemePicker from footer
- Modify: `client/src/components/TopBar.jsx` — add ThemePicker
- Modify: `client/src/context/ThemeContext.jsx` — export ThemePicker (or keep inline)

**Step 1: Extract ThemePicker to its own file or keep inline**

Since TopBar needs it, the simplest approach is to move the `ThemePicker` function from Sidebar.jsx into TopBar.jsx (it's self-contained — just needs `useTheme` and `THEMES`). Remove the `collapsed` prop logic — in the TopBar it's always an icon button with dropdown.

**Step 2: Add palette icon button to TopBar**

Place it on the right side of the TopBar, after the filter buttons:

```jsx
<div className="relative">
  <button
    onClick={() => setThemeOpen(o => !o)}
    className="p-2 rounded-lg text-ink-mid hover:text-ink hover:bg-float transition-colors"
    title="Change theme"
  >
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="6" cy="6" r="1.2" fill="currentColor"/>
      <circle cx="10" cy="6" r="1.2" fill="currentColor"/>
      <circle cx="5" cy="9" r="1.2" fill="currentColor"/>
      <circle cx="10.5" cy="9" r="1.2" fill="currentColor"/>
    </svg>
  </button>
  {themeOpen && <ThemeDropdown onClose={() => setThemeOpen(false)} />}
</div>
```

**Step 3: Remove ThemePicker from Sidebar footer**

Delete the `<ThemePicker collapsed={collapsed} />` line and the ThemePicker component definition from Sidebar.jsx. The footer becomes just the sync button.

**Step 4: Clean up sidebar footer spacing**

Remove extra padding/spacing that was needed for the theme picker.

**Step 5: Verify**

Theme picker appears in TopBar. Clicking palette icon opens theme grid dropdown. Selecting a theme applies it and closes the dropdown. Sidebar footer is clean with just the sync button.

**Step 6: Commit**

```
feat: move theme picker from sidebar to topbar
```

---

### Task 8: Final polish and cleanup

**Files:**
- Modify: `client/src/components/Sidebar.jsx` — remove dead code, tighten spacing
- Modify: `client/src/App.jsx` — pass `onUpdateCategory` to Sidebar

**Step 1: Remove old context menu code**

Ensure the old `ctxMenu` state, fixed-position context menu div, and all `onCtxMenu` prop threading are fully removed (should be done in Task 2, but verify).

**Step 2: Thread `onUpdateCategory` through App.jsx → Sidebar**

In App.jsx, destructure `updateCategory` from `useCategories` and pass it as `onUpdateCategory` to `<Sidebar>`.

**Step 3: Tighten spacing throughout**

- Reduce vertical gaps between category rows
- Ensure collapsed sidebar still looks good
- Check that drag-and-drop still works with the new row structure

**Step 4: Test all interactions end-to-end**

- Hover → count/menu swap works
- 3-dot → menu opens
- Rename → inline edit
- Add subcategory → inline input
- Change icon → emoji picker → persists
- Change color → color picker → persists
- Delete → confirmation → works
- Drag reorder → still works
- Expand/collapse → animated
- Theme picker in TopBar → works
- Collapsed sidebar → tooltips, no broken layout

**Step 5: Commit**

```
feat: sidebar redesign — final polish and cleanup
```

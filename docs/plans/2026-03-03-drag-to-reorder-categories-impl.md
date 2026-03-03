# Drag-to-Reorder Categories Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users drag top-level sidebar categories into any order, persisted to `data/meta.json`.

**Architecture:** Category order is the array order in `meta.json` — no schema change needed. A new `PUT /api/categories/reorder` endpoint rewrites the array. On the client, `@dnd-kit/sortable` wraps each top-level `CategoryRow` with a `useSortable` hook; `Uncategorized` is always pinned last and never draggable. Reorder is optimistic — local state updates immediately, server write happens in the background.

**Tech Stack:** Node.js + Express + Vitest (server); React 18 + `@dnd-kit/core` + `@dnd-kit/sortable` + Tailwind v3 (client).

---

## Task 1: `reorderCategories` helper + test

**Files:**
- Modify: `server/data.js`
- Modify: `server/data.test.js`

### Step 1: Add failing test

Append to `server/data.test.js` (after existing describe blocks, add the import alongside the others):

```js
import {
  migrateMeta, flattenCategories,
  addCategory, removeCategory, renameCategory,
  reorderCategories,   // ← add this
} from './data.js'
```

Then append this describe block:

```js
describe('reorderCategories', () => {
  const meta = {
    categories: [
      { name: 'Design', children: [] },
      { name: 'Dev',    children: ['Frontend'] },
      { name: 'Reads',  children: [] },
    ],
  }

  it('reorders categories to match supplied name array', () => {
    const result = reorderCategories(meta, ['Reads', 'Dev', 'Design'])
    expect(result.categories.map(c => c.name)).toEqual(['Reads', 'Dev', 'Design'])
  })

  it('preserves children when reordering', () => {
    const result = reorderCategories(meta, ['Dev', 'Design', 'Reads'])
    expect(result.categories[0].children).toEqual(['Frontend'])
  })

  it('throws if an unknown name is supplied', () => {
    expect(() => reorderCategories(meta, ['Design', 'Dev', 'Unknown'])).toThrow()
  })

  it('throws if order length does not match category count', () => {
    expect(() => reorderCategories(meta, ['Design', 'Dev'])).toThrow()
  })
})
```

### Step 2: Run — confirm FAIL

```bash
cd /Users/tyler/Development/Booked/server && npm test
```

Expected: FAIL — `reorderCategories is not exported`

### Step 3: Implement in `server/data.js`

Append after the existing `renameCategory` function:

```js
/** Return new meta with categories reordered. nameOrder must include every category name. */
export function reorderCategories(meta, nameOrder) {
  if (nameOrder.length !== meta.categories.length) {
    throw new Error('order must include all categories')
  }
  const byName = Object.fromEntries(meta.categories.map(c => [c.name, c]))
  for (const name of nameOrder) {
    if (!byName[name]) throw new Error(`Unknown category "${name}"`)
  }
  return { ...meta, categories: nameOrder.map(n => byName[n]) }
}
```

### Step 4: Run — confirm PASS

```bash
cd /Users/tyler/Development/Booked/server && npm test
```

Expected: All 35 tests pass.

### Step 5: Commit

```bash
git add server/data.js server/data.test.js
git commit -m "feat: reorderCategories helper"
```

---

## Task 2: `PUT /api/categories/reorder` route + API test

**Files:**
- Modify: `server/routes/categories.js`
- Modify: `server/api.test.js`

### Step 1: Add failing API test

Append to `server/api.test.js` (after the DELETE /api/categories block):

```js
describe('PUT /api/categories/reorder', () => {
  it('reorders categories', async () => {
    // Seed state has: Design, Dev (with Frontend), Uncategorized
    const res = await request(app)
      .put('/api/categories/reorder')
      .send({ order: ['Dev', 'Design', 'Uncategorized'] })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    const check = await request(app).get('/api/categories')
    expect(check.body[0].name).toBe('Dev')
  })

  it('returns 400 if order is missing names', async () => {
    const res = await request(app)
      .put('/api/categories/reorder')
      .send({ order: ['Dev'] })
    expect(res.status).toBe(400)
  })

  it('returns 400 if an unknown name is supplied', async () => {
    const res = await request(app)
      .put('/api/categories/reorder')
      .send({ order: ['Dev', 'Design', 'Uncategorized', 'Ghost'] })
    expect(res.status).toBe(400)
  })
})
```

### Step 2: Run — confirm FAIL

```bash
cd /Users/tyler/Development/Booked/server && npm test
```

Expected: 3 new tests FAIL (route returns 404).

### Step 3: Add route to `server/routes/categories.js`

Add this import at the top alongside the other data imports:

```js
import {
  readMeta, writeMeta, readBookmarks, writeBookmarks,
  addCategory, removeCategory, renameCategory, reorderCategories,
} from '../data.js'
```

Add this route **before** the `export default router` line:

```js
// PUT /api/categories/reorder — reorder top-level categories
router.put('/reorder', (req, res) => {
  const { order } = req.body
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'order must be an array of category names' })
  }

  let meta = readMeta()
  try {
    meta = reorderCategories(meta, order)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }

  writeMeta(meta)
  res.json({ ok: true })
})
```

### Step 4: Run — confirm PASS

```bash
cd /Users/tyler/Development/Booked/server && npm test
```

Expected: All 38 tests pass.

### Step 5: Commit

```bash
git add server/routes/categories.js server/api.test.js
git commit -m "feat: PUT /api/categories/reorder endpoint"
```

---

## Task 3: Install `@dnd-kit` + add `reorderCategories` to hook

**Files:**
- Modify: `client/package.json` (via npm install)
- Modify: `client/src/hooks/useCategories.js`

### Step 1: Install packages

```bash
cd /Users/tyler/Development/Booked/client
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: packages added to `node_modules` and `package.json`.

### Step 2: Add `reorderCategories` to `useCategories.js`

Read the current file. Add this method inside the hook, after `deleteCategory`:

```js
const reorderCategories = useCallback(async (nameOrder) => {
  // Optimistic update — reorder local state immediately
  setCategories(prev => {
    const byName = Object.fromEntries(prev.map(c => [c.name, c]))
    return nameOrder.map(n => byName[n]).filter(Boolean)
  })

  const res = await fetch('/api/categories/reorder', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order: nameOrder }),
  })
  if (!res.ok) {
    // Revert on failure
    await fetch_()
    throw new Error((await res.json()).error)
  }
}, [fetch_])
```

Add `reorderCategories` to the return value:

```js
return { categories, createCategory, renameCategory, deleteCategory, reorderCategories, refetch: fetch_ }
```

### Step 3: Wire into `App.jsx`

In `client/src/App.jsx`, update the `useCategories` destructure to include `reorderCategories`:

```js
const { categories, createCategory, renameCategory: renameCat, deleteCategory, reorderCategories } = useCategories()
```

Add to the `<Sidebar>` props:

```jsx
onReorderCategories={reorderCategories}
```

### Step 4: Commit

```bash
git add client/package.json client/package-lock.json client/src/hooks/useCategories.js client/src/App.jsx
git commit -m "feat: reorderCategories in useCategories hook"
```

---

## Task 4: Sidebar — drag handle + DnD wiring

**Files:**
- Modify: `client/src/components/Sidebar.jsx`

This is the only UI task. Make these changes in order.

### Step 1: Add imports at the top of `Sidebar.jsx`

After the existing imports (`useState`, `useEffect`, `useRef`, `clsx`), add:

```js
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
```

### Step 2: Add `SortableCategoryRow` wrapper component

Add this component **between** `AddInput` and the `Sidebar` export:

```jsx
function SortableCategoryRow({ id, ...props }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <CategoryRow
        {...props}
        dragHandleListeners={listeners}
        dragHandleAttributes={attributes}
      />
    </div>
  )
}
```

### Step 3: Add drag handle to `CategoryRow`

In the `CategoryRow` function, add `dragHandleListeners = null` and `dragHandleAttributes = {}` to the prop list.

Inside the non-editing branch, find the left side of the row (just after the expand chevron / spacer `<span>`). Add the drag handle **before** the main click button:

```jsx
{depth === 0 && !isProtected && dragHandleListeners && (
  <button
    {...dragHandleListeners}
    {...dragHandleAttributes}
    tabIndex={-1}
    className="cursor-grab active:cursor-grabbing p-1 shrink-0 text-ink-low opacity-0 group-hover/row:opacity-100 hover:text-ink-mid transition-opacity touch-none"
    onClick={e => e.stopPropagation()}
  >
    <svg className="w-3 h-3" viewBox="0 0 8 14" fill="currentColor">
      <circle cx="2" cy="2"  r="1.2"/><circle cx="6" cy="2"  r="1.2"/>
      <circle cx="2" cy="7"  r="1.2"/><circle cx="6" cy="7"  r="1.2"/>
      <circle cx="2" cy="12" r="1.2"/><circle cx="6" cy="12" r="1.2"/>
    </svg>
  </button>
)}
```

### Step 4: Add DnD state + sensors to `Sidebar`

Add `onReorderCategories` to the Sidebar prop list.

Add these inside the Sidebar function body (after existing `useState` calls):

```js
const [activeId, setActiveId] = useState(null)

const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
)

const draggable = categories.filter(c => c.name !== 'Uncategorized')
const uncategorized = categories.find(c => c.name === 'Uncategorized')
const activeCategory = draggable.find(c => c.name === activeId)

function handleDragEnd({ active, over }) {
  setActiveId(null)
  if (!over || active.id === over.id) return
  const oldIndex = draggable.findIndex(c => c.name === active.id)
  const newIndex = draggable.findIndex(c => c.name === over.id)
  const reordered = arrayMove(draggable, oldIndex, newIndex)
  const newOrder = [...reordered.map(c => c.name), ...(uncategorized ? ['Uncategorized'] : [])]
  onReorderCategories(newOrder)
}
```

### Step 5: Replace the category tree render section in Sidebar

Find the `{/* Category tree */}` block (the `categories.map(...)` section). Replace it with:

```jsx
{/* Category tree */}
{!collapsed ? (
  <DndContext
    sensors={sensors}
    collisionDetection={closestCenter}
    onDragStart={({ active }) => setActiveId(active.id)}
    onDragEnd={handleDragEnd}
    onDragCancel={() => setActiveId(null)}
  >
    <SortableContext
      items={draggable.map(c => c.name)}
      strategy={verticalListSortingStrategy}
    >
      {draggable.map(cat => (
        <div key={cat.name}>
          <SortableCategoryRow
            id={cat.name}
            name={cat.name}
            count={cat.count}
            active={category === cat.name && !subcategory}
            depth={0}
            expanded={expandedCats[cat.name]}
            hasChildren={cat.children.length > 0}
            onClick={() => { setCategory(cat.name); setSubcategory(null) }}
            onToggleExpand={() => toggleExpand(cat.name)}
            onAdd={() => setAddingSub(cat.name)}
            onRename={(newName) => onRenameCategory(cat.name, newName)}
            onDelete={() => onDeleteCategory(cat.name)}
            collapsed={false}
          />
          {expandedCats[cat.name] && (
            <div className="space-y-0.5">
              {cat.children.map(sub => (
                <CategoryRow
                  key={sub.name}
                  name={sub.name}
                  count={sub.count}
                  active={category === cat.name && subcategory === sub.name}
                  depth={1}
                  expanded={false}
                  hasChildren={false}
                  onClick={() => { setCategory(cat.name); setSubcategory(sub.name) }}
                  onToggleExpand={null}
                  onAdd={null}
                  onRename={(newName) => onRenameCategory(sub.name, newName, cat.name)}
                  onDelete={() => onDeleteCategory(sub.name, cat.name)}
                  collapsed={false}
                />
              ))}
              {addingSub === cat.name && (
                <div className="pl-6">
                  <AddInput
                    placeholder="Subcategory name…"
                    onAdd={(name) => { onCreateCategory(name, cat.name); setAddingSub(null) }}
                    onCancel={() => setAddingSub(null)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </SortableContext>

    <DragOverlay>
      {activeCategory && (
        <div className="bg-lift border border-wire rounded-lg shadow-xl opacity-95">
          <CategoryRow
            name={activeCategory.name}
            count={activeCategory.count}
            active={false}
            depth={0}
            expanded={false}
            hasChildren={activeCategory.children.length > 0}
            onClick={() => {}}
            onToggleExpand={null}
            onAdd={null}
            onRename={null}
            onDelete={null}
            collapsed={false}
          />
        </div>
      )}
    </DragOverlay>
  </DndContext>
) : (
  /* Collapsed icon rail — no drag, just icons */
  <>
    {draggable.map(cat => (
      <CategoryRow
        key={cat.name}
        name={cat.name}
        count={cat.count}
        active={category === cat.name && !subcategory}
        depth={0}
        expanded={false}
        hasChildren={false}
        onClick={() => { setCategory(cat.name); setSubcategory(null) }}
        onToggleExpand={null}
        onAdd={null}
        onRename={null}
        onDelete={null}
        collapsed={true}
      />
    ))}
  </>
)}

{/* Uncategorized — always pinned last, never draggable */}
{uncategorized && (
  <CategoryRow
    name="Uncategorized"
    count={uncategorized.count}
    active={category === 'Uncategorized' && !subcategory}
    depth={0}
    expanded={false}
    hasChildren={false}
    onClick={() => { setCategory('Uncategorized'); setSubcategory(null) }}
    onToggleExpand={null}
    onAdd={null}
    onRename={null}
    onDelete={null}
    collapsed={collapsed}
  />
)}
```

### Step 6: Commit

```bash
git add client/src/components/Sidebar.jsx
git commit -m "feat: drag-to-reorder top-level categories in sidebar"
```

---

## Task 5: Build + verify

### Step 1: Run server tests

```bash
cd /Users/tyler/Development/Booked/server && npm test
```

Expected: 38 tests pass.

### Step 2: Build client

```bash
cd /Users/tyler/Development/Booked/client && npx vite build
```

Expected: clean build, no errors.

### Step 3: Manual verification checklist

Start the app (`npm run dev` from project root) and verify:

- [ ] Hovering a category row reveals the grip handle (⠿) on the left
- [ ] `Uncategorized` never shows a grip handle
- [ ] Dragging a category reorders it in the sidebar immediately (optimistic)
- [ ] After refresh, the new order persists
- [ ] The dragged row goes semi-transparent during drag; the overlay follows the cursor
- [ ] Collapsed sidebar has no drag handles (icon rail only)
- [ ] Keyboard: Tab to a grip handle, Space to pick up, arrow keys to move, Space/Enter to drop

### Step 4: Commit dist

```bash
git add client/dist/
git commit -m "chore: production build with drag-to-reorder"
```

# Nested Category Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add nested category/subcategory CRUD to Booked — inline sidebar tree, REST API, and dynamic AI classifier.

**Architecture:** Categories are stored in `data/meta.json` as `{ name, children[] }` objects. Each bookmark gains an optional `subcategory` string. A new REST resource at `/api/categories` handles CRUD with cascade semantics. The sidebar renders a collapsible tree with inline create/rename/delete. The AI classifier receives the live category list and returns `{ category, subcategory }`.

**Tech Stack:** Node.js + Express + Vitest + supertest (server); React 18 + Tailwind v3 + clsx (client). Test runner: `npm test` from `server/` directory.

---

## Task 1: Migrate data model + category helpers in `data.js`

**Files:**
- Modify: `server/data.js`
- Test: `server/data.test.js`

### Step 1: Write failing tests for migration + helpers

Add to `server/data.test.js` — import the pure functions we're about to write:

```js
import {
  migrateMeta,
  flattenCategories,
  addCategory,
  removeCategory,
  renameCategory,
} from './data.js'

describe('migrateMeta', () => {
  it('converts flat string array to nested objects', () => {
    const old = { categories: ['Design', 'Dev'], totalBookmarks: 0 }
    const result = migrateMeta(old)
    expect(result.categories).toEqual([
      { name: 'Design', children: [] },
      { name: 'Dev',    children: [] },
    ])
  })

  it('is a no-op if already in new format', () => {
    const already = { categories: [{ name: 'Design', children: [] }] }
    expect(migrateMeta(already).categories[0]).toEqual({ name: 'Design', children: [] })
  })
})

describe('flattenCategories', () => {
  it('returns flat list of all names (parents + children)', () => {
    const tree = [
      { name: 'Dev', children: ['Frontend', 'Backend'] },
      { name: 'Design', children: [] },
    ]
    expect(flattenCategories(tree)).toEqual(['Dev', 'Frontend', 'Backend', 'Design'])
  })
})

describe('addCategory', () => {
  it('adds a top-level category', () => {
    const meta = { categories: [{ name: 'Dev', children: [] }] }
    const result = addCategory(meta, 'Design')
    expect(result.categories).toHaveLength(2)
    expect(result.categories[1].name).toBe('Design')
  })

  it('adds a subcategory under a parent', () => {
    const meta = { categories: [{ name: 'Dev', children: [] }] }
    const result = addCategory(meta, 'Frontend', 'Dev')
    expect(result.categories[0].children).toContain('Frontend')
  })

  it('throws if name already exists', () => {
    const meta = { categories: [{ name: 'Dev', children: [] }] }
    expect(() => addCategory(meta, 'Dev')).toThrow()
  })
})

describe('removeCategory', () => {
  it('removes a top-level category', () => {
    const meta = { categories: [{ name: 'Dev', children: [] }, { name: 'Design', children: [] }] }
    const result = removeCategory(meta, 'Dev')
    expect(result.categories).toHaveLength(1)
    expect(result.categories[0].name).toBe('Design')
  })

  it('removes a subcategory string from its parent', () => {
    const meta = { categories: [{ name: 'Dev', children: ['Frontend', 'Backend'] }] }
    const result = removeCategory(meta, 'Frontend', 'Dev')
    expect(result.categories[0].children).not.toContain('Frontend')
  })

  it('throws if trying to remove Uncategorized', () => {
    const meta = { categories: [{ name: 'Uncategorized', children: [] }] }
    expect(() => removeCategory(meta, 'Uncategorized')).toThrow()
  })
})

describe('renameCategory', () => {
  it('renames a top-level category', () => {
    const meta = { categories: [{ name: 'Dev', children: [] }] }
    const result = renameCategory(meta, 'Dev', 'Engineering')
    expect(result.categories[0].name).toBe('Engineering')
  })

  it('renames a subcategory within its parent', () => {
    const meta = { categories: [{ name: 'Dev', children: ['Frontend'] }] }
    const result = renameCategory(meta, 'Frontend', 'FE', 'Dev')
    expect(result.categories[0].children).toContain('FE')
    expect(result.categories[0].children).not.toContain('Frontend')
  })

  it('throws if trying to rename Uncategorized', () => {
    const meta = { categories: [{ name: 'Uncategorized', children: [] }] }
    expect(() => renameCategory(meta, 'Uncategorized', 'Other')).toThrow()
  })
})
```

### Step 2: Run tests to verify they fail

```bash
cd /Users/tyler/Development/Booked/server
npm test
```

Expected: FAIL — functions not exported from `data.js`

### Step 3: Implement helpers in `data.js`

Add these exports to `server/data.js` (after the existing exports):

```js
// ── Category tree helpers ──────────────────────────────────────

/** Convert old flat string array to new nested format. No-op if already migrated. */
export function migrateMeta(meta) {
  if (!Array.isArray(meta.categories) || meta.categories.length === 0) return meta
  if (typeof meta.categories[0] === 'object') return meta // already migrated
  return {
    ...meta,
    categories: meta.categories.map(name => ({ name, children: [] })),
  }
}

/** Flat list of all category names: parents then their children. */
export function flattenCategories(tree) {
  return tree.flatMap(cat => [cat.name, ...cat.children])
}

/** Return new meta with a category added. Throws if name already exists. */
export function addCategory(meta, name, parent = null) {
  const allNames = flattenCategories(meta.categories)
  if (allNames.includes(name)) throw new Error(`Category "${name}" already exists`)

  if (parent) {
    const parentCat = meta.categories.find(c => c.name === parent)
    if (!parentCat) throw new Error(`Parent category "${parent}" not found`)
    return {
      ...meta,
      categories: meta.categories.map(c =>
        c.name === parent ? { ...c, children: [...c.children, name] } : c
      ),
    }
  }

  return { ...meta, categories: [...meta.categories, { name, children: [] }] }
}

/** Return new meta with a category removed. Throws on protected names. */
export function removeCategory(meta, name, parent = null) {
  if (name === 'Uncategorized') throw new Error('Cannot delete Uncategorized')

  if (parent) {
    return {
      ...meta,
      categories: meta.categories.map(c =>
        c.name === parent ? { ...c, children: c.children.filter(ch => ch !== name) } : c
      ),
    }
  }

  return { ...meta, categories: meta.categories.filter(c => c.name !== name) }
}

/** Return new meta with a category renamed. Throws on protected names. */
export function renameCategory(meta, oldName, newName, parent = null) {
  if (oldName === 'Uncategorized') throw new Error('Cannot rename Uncategorized')

  if (parent) {
    return {
      ...meta,
      categories: meta.categories.map(c =>
        c.name === parent
          ? { ...c, children: c.children.map(ch => (ch === oldName ? newName : ch)) }
          : c
      ),
    }
  }

  return {
    ...meta,
    categories: meta.categories.map(c => (c.name === oldName ? { ...c, name: newName } : c)),
  }
}
```

Also update `readMeta` to auto-migrate on read:

```js
// Replace the existing readMeta:
export function readMeta() {
  const raw = JSON.parse(readFileSync(META_PATH, 'utf-8'))
  const migrated = migrateMeta(raw)
  // Persist migration immediately so subsequent reads are already in new format
  if (migrated !== raw) writeFileSync(META_PATH, JSON.stringify(migrated, null, 2))
  return migrated
}
```

### Step 4: Run tests

```bash
cd /Users/tyler/Development/Booked/server && npm test
```

Expected: All new tests PASS (existing tests may warn about old meta format — that's fine, they'll be fixed in Task 2).

### Step 5: Commit

```bash
git add server/data.js server/data.test.js
git commit -m "feat: nested category data model + migration helpers"
```

---

## Task 2: `/api/categories` REST routes

**Files:**
- Create: `server/routes/categories.js`
- Modify: `server/index.js`
- Modify: `server/routes/bookmarks.js` (add `subcategory` to allowed patch fields)
- Modify: `server/api.test.js`

### Step 1: Update the test seed to new meta format + add category API tests

In `server/api.test.js`, update the `beforeAll` seed:

```js
// In beforeAll — change categories line:
writeFileSync(join(DATA_DIR, 'meta.json'), JSON.stringify({
  lastSyncedAt: null,
  categories: [
    { name: 'Design', children: [] },
    { name: 'Dev',    children: ['Frontend'] },
    { name: 'Uncategorized', children: [] },
  ],
  totalBookmarks: 1
}, null, 2))
```

Add new describe blocks at the end of `api.test.js`:

```js
describe('GET /api/categories', () => {
  it('returns category tree with counts', async () => {
    const res = await request(app).get('/api/categories')
    expect(res.status).toBe(200)
    expect(res.body).toBeInstanceOf(Array)
    expect(res.body[0]).toHaveProperty('name')
    expect(res.body[0]).toHaveProperty('children')
    expect(res.body[0]).toHaveProperty('count')
  })
})

describe('POST /api/categories', () => {
  it('creates a top-level category', async () => {
    const res = await request(app).post('/api/categories').send({ name: 'Tools' })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Tools')
  })

  it('creates a subcategory under an existing parent', async () => {
    const res = await request(app)
      .post('/api/categories')
      .send({ name: 'Backend', parent: 'Dev' })
    expect(res.status).toBe(201)
    expect(res.body.parent).toBe('Dev')
  })

  it('returns 409 if name already exists', async () => {
    const res = await request(app).post('/api/categories').send({ name: 'Design' })
    expect(res.status).toBe(409)
  })

  it('returns 400 if name is missing', async () => {
    const res = await request(app).post('/api/categories').send({})
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/categories/:name', () => {
  it('renames a category', async () => {
    const res = await request(app)
      .patch('/api/categories/Tools')
      .send({ name: 'Tooling' })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Tooling')
  })

  it('returns 400 trying to rename Uncategorized', async () => {
    const res = await request(app)
      .patch('/api/categories/Uncategorized')
      .send({ name: 'Other' })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/categories/:name', () => {
  it('deletes a category', async () => {
    const res = await request(app).delete('/api/categories/Tooling')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns 400 trying to delete Uncategorized', async () => {
    const res = await request(app).delete('/api/categories/Uncategorized')
    expect(res.status).toBe(400)
  })
})
```

### Step 2: Run to confirm failures

```bash
cd /Users/tyler/Development/Booked/server && npm test
```

Expected: FAIL — `/api/categories` routes don't exist.

### Step 3: Create `server/routes/categories.js`

```js
import { Router } from 'express'
import {
  readMeta, writeMeta, readBookmarks, writeBookmarks,
  addCategory, removeCategory, renameCategory, flattenCategories,
} from '../data.js'

const router = Router()

// GET /api/categories — tree with per-node bookmark counts
router.get('/', (req, res) => {
  const meta = readMeta()
  const bookmarks = readBookmarks()

  const countFor = (name) => bookmarks.filter(b => !b.archived && b.category === name).length
  const countSub = (parent, sub) =>
    bookmarks.filter(b => !b.archived && b.category === parent && b.subcategory === sub).length

  const tree = meta.categories.map(cat => ({
    name: cat.name,
    count: countFor(cat.name),
    children: cat.children.map(sub => ({ name: sub, count: countSub(cat.name, sub) })),
  }))

  res.json(tree)
})

// POST /api/categories — create top-level or subcategory
router.post('/', (req, res) => {
  const { name, parent } = req.body
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name is required' })
  }

  let meta = readMeta()
  try {
    meta = addCategory(meta, name.trim(), parent || null)
  } catch (err) {
    return res.status(409).json({ error: err.message })
  }

  writeMeta(meta)
  res.status(201).json({ name: name.trim(), parent: parent || null, children: [] })
})

// PATCH /api/categories/:name — rename (cascades to bookmarks)
router.patch('/:name', (req, res) => {
  const oldName = req.params.name
  const { name: newName, parent } = req.body

  if (!newName) return res.status(400).json({ error: 'name is required' })

  let meta = readMeta()
  try {
    meta = renameCategory(meta, oldName, newName.trim(), parent || null)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }

  // Cascade to bookmarks
  const bookmarks = readBookmarks()
  if (parent) {
    // Renaming a subcategory
    bookmarks.forEach(b => {
      if (b.category === parent && b.subcategory === oldName) b.subcategory = newName.trim()
    })
  } else {
    // Renaming a top-level category
    bookmarks.forEach(b => { if (b.category === oldName) b.category = newName.trim() })
  }

  writeMeta(meta)
  writeBookmarks(bookmarks)
  res.json({ name: newName.trim(), parent: parent || null })
})

// DELETE /api/categories/:name — delete (cascades bookmarks)
router.delete('/:name', (req, res) => {
  const { name } = req.params
  const { parent } = req.query // pass ?parent=Dev when deleting a subcategory

  let meta = readMeta()
  try {
    meta = removeCategory(meta, name, parent || null)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }

  // Cascade bookmarks
  const bookmarks = readBookmarks()
  if (parent) {
    // Sub deleted: move those bookmarks to the parent (subcategory = null)
    bookmarks.forEach(b => {
      if (b.category === parent && b.subcategory === name) b.subcategory = null
    })
  } else {
    // Top-level deleted: move all its bookmarks to Uncategorized
    bookmarks.forEach(b => {
      if (b.category === name) { b.category = 'Uncategorized'; b.subcategory = null }
    })
  }

  writeMeta(meta)
  writeBookmarks(bookmarks)
  res.json({ ok: true })
})

export default router
```

### Step 4: Mount route in `server/index.js`

```js
// Add import after existing route imports:
import categoriesRouter from './routes/categories.js'

// Add after existing app.use lines:
app.use('/api/categories', categoriesRouter)
```

### Step 5: Add `subcategory` to bookmark PATCH whitelist

In `server/routes/bookmarks.js`, update line:
```js
// Change:
const allowed = ['tags', 'category', 'notes', 'archived']
// To:
const allowed = ['tags', 'category', 'subcategory', 'notes', 'archived']
```

### Step 6: Run tests

```bash
cd /Users/tyler/Development/Booked/server && npm test
```

Expected: All tests PASS.

### Step 7: Commit

```bash
git add server/routes/categories.js server/index.js server/routes/bookmarks.js server/api.test.js
git commit -m "feat: /api/categories REST endpoints with cascade semantics"
```

---

## Task 3: Dynamic AI classifier

**Files:**
- Modify: `server/classifier.js`
- Modify: `server/routes/sync.js`

### Step 1: Update `classifier.js`

Replace entirely:

```js
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildSystemPrompt(categories) {
  // categories: [{ name, children[] }]
  const lines = categories.flatMap(cat =>
    cat.children.length > 0
      ? [`- "${cat.name}" with subcategories: ${cat.children.map(c => `"${c}"`).join(', ')}`]
      : [`- "${cat.name}"`]
  )
  return `You are a bookmark classifier. Given tweet content, classify it into the user's category system.

Categories:
${lines.join('\n')}

Return a JSON object with:
- "category": exactly one top-level category name from the list above
- "subcategory": the most specific subcategory name if one fits, otherwise null
- "tags": array of 2-5 lowercase kebab-case tags relevant to the content

Respond with ONLY valid JSON. No explanation, no markdown, no code fences.

Examples:
{"category": "Dev", "subcategory": "Frontend", "tags": ["react", "performance"]}
{"category": "Design", "subcategory": null, "tags": ["figma", "ui-systems"]}`
}

export async function classifyBookmark(text, authorHandle, categories = []) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { category: 'Uncategorized', subcategory: null, tags: [] }
  }

  const validTopLevel = categories.map(c => c.name)
  const validSubs = Object.fromEntries(categories.map(c => [c.name, c.children]))

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: buildSystemPrompt(categories),
      messages: [{ role: 'user', content: `Author: @${authorHandle}\n\n${text.slice(0, 500)}` }],
    })

    const parsed = JSON.parse(msg.content[0].text.trim())
    const category = validTopLevel.includes(parsed.category) ? parsed.category : 'Uncategorized'
    const validSubList = validSubs[category] || []
    const subcategory = validSubList.includes(parsed.subcategory) ? parsed.subcategory : null

    return {
      category,
      subcategory,
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5).map(t => String(t).toLowerCase()) : [],
    }
  } catch {
    return { category: 'Uncategorized', subcategory: null, tags: [] }
  }
}

export async function classifyBatch(bookmarks, categories = []) {
  const results = []
  for (const bm of bookmarks) {
    const classification = await classifyBookmark(bm.text, bm.author?.handle || 'unknown', categories)
    results.push({ id: bm.id, ...classification })
    await new Promise(r => setTimeout(r, 150))
  }
  return results
}
```

### Step 2: Update `server/routes/sync.js` to pass category tree

```js
// Change the classifyBatch call line from:
const classified = await classifyBatch(scraped)
// To:
const classified = await classifyBatch(scraped, meta.categories || [])

// And update the enriched map to include subcategory:
const enriched = scraped.map(b => ({
  ...b,
  category:    classifiedById[b.id]?.category    || 'Uncategorized',
  subcategory: classifiedById[b.id]?.subcategory ?? null,
  tags:        classifiedById[b.id]?.tags         || [],
  aiSuggestedTags: classifiedById[b.id]?.tags     || [],
}))
```

### Step 3: Commit

```bash
git add server/classifier.js server/routes/sync.js
git commit -m "feat: dynamic AI classifier reads live category tree, returns subcategory"
```

---

## Task 4: Client — `useCategories` hook

**Files:**
- Create: `client/src/hooks/useCategories.js`

```js
import { useState, useEffect, useCallback } from 'react'

export function useCategories() {
  const [categories, setCategories] = useState([])

  const fetch_ = useCallback(async () => {
    const res = await fetch('/api/categories')
    if (res.ok) setCategories(await res.json())
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  const createCategory = useCallback(async (name, parent = null) => {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parent }),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetch_()
  }, [fetch_])

  const renameCategory = useCallback(async (name, newName, parent = null) => {
    const res = await fetch(`/api/categories/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, parent }),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetch_()
  }, [fetch_])

  const deleteCategory = useCallback(async (name, parent = null) => {
    const url = parent
      ? `/api/categories/${encodeURIComponent(name)}?parent=${encodeURIComponent(parent)}`
      : `/api/categories/${encodeURIComponent(name)}`
    const res = await fetch(url, { method: 'DELETE' })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetch_()
  }, [fetch_])

  return { categories, createCategory, renameCategory, deleteCategory, refetch: fetch_ }
}
```

**Commit:**
```bash
git add client/src/hooks/useCategories.js
git commit -m "feat: useCategories hook with CRUD operations"
```

---

## Task 5: Client — update `useFilters.js` for subcategory

**Files:**
- Modify: `client/src/hooks/useFilters.js`

Add `subcategory` state and update filtering. Find the `filtered` useMemo and add:

```js
// Add to useState block:
const [subcategory, setSubcategory] = useState(null)

// Reset subcategory when category changes — add this useEffect:
useEffect(() => { setSubcategory(null) }, [category])

// In the filtered useMemo, after the category filter line:
// Change:
if (category !== 'All') result = result.filter(b => b.category === category)
// To:
if (category !== 'All') {
  result = result.filter(b => b.category === category)
  if (subcategory) result = result.filter(b => b.subcategory === subcategory)
}

// Add subcategory to return value:
return {
  filtered, category, setCategory, selectedTags, setSelectedTags,
  sort, setSort, timeRange, setTimeRange,
  hasMediaOnly, setHasMediaOnly, showArchived, setShowArchived,
  subcategory, setSubcategory,   // ← add these
}
```

**Commit:**
```bash
git add client/src/hooks/useFilters.js
git commit -m "feat: subcategory filter in useFilters"
```

---

## Task 6: Wire `useCategories` in `App.jsx`

**Files:**
- Modify: `client/src/App.jsx`

```js
// Add import:
import { useCategories } from './hooks/useCategories.js'

// Add inside BookedApp():
const { categories, createCategory, renameCategory, deleteCategory } = useCategories()

// Pass to Sidebar:
<Sidebar
  ...existing props...
  categories={categories}
  subcategory={filters.subcategory}
  setSubcategory={filters.setSubcategory}
  onCreateCategory={createCategory}
  onRenameCategory={renameCategory}
  onDeleteCategory={deleteCategory}
/>

// Pass to BookmarkDetail:
<BookmarkDetail
  ...existing props...
  categories={categories}
/>
```

**Commit:**
```bash
git add client/src/App.jsx
git commit -m "feat: wire useCategories into App"
```

---

## Task 7: Sidebar tree nav with inline CRUD

**Files:**
- Modify: `client/src/components/Sidebar.jsx`

This is the largest client task. Replace the nav section with a full tree. Key sub-components to add inside `Sidebar.jsx`:

### `CategoryRow` component

Handles a single row (parent or child) with hover actions:

```jsx
function CategoryRow({
  name, count, active, depth, expanded, hasChildren,
  onClick, onToggleExpand,
  onAdd, onRename, onDelete,
  collapsed: sidebarCollapsed,
}) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(name)
  const [confirming, setConfirming] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commitRename = () => {
    const trimmed = editVal.trim()
    if (trimmed && trimmed !== name) onRename(trimmed)
    setEditing(false)
  }

  const isProtected = name === 'Uncategorized' || name === 'All'
  const indent = depth === 1 ? 'pl-6' : ''

  if (sidebarCollapsed) {
    // In collapsed icon-rail, only top-level rows show (depth 0)
    if (depth > 0) return null
    return (
      <Tip label={name} collapsed>
        <button
          onClick={onClick}
          className={clsx(
            'w-full flex justify-center p-2.5 rounded-lg transition-colors',
            active ? 'bg-brand-wash text-brand' : 'text-ink-mid hover:text-ink hover:bg-float'
          )}
        >
          {getCategoryIcon(name)}
        </button>
      </Tip>
    )
  }

  return (
    <div className={clsx('group/row relative', indent)}>
      {editing ? (
        <div className="flex items-center px-2 py-1">
          <input
            ref={inputRef}
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') { setEditVal(name); setEditing(false) }
            }}
            onBlur={commitRename}
            className="flex-1 bg-float border border-brand rounded-md px-2 py-0.5 text-sm text-ink outline-none"
          />
        </div>
      ) : (
        <div className="flex items-center rounded-lg overflow-hidden">
          {/* Expand chevron for parents */}
          {hasChildren ? (
            <button
              onClick={onToggleExpand}
              className="p-1 shrink-0 text-ink-low hover:text-ink-mid transition-colors"
            >
              <svg className={clsx('w-3 h-3 transition-transform', expanded && 'rotate-90')} viewBox="0 0 10 10" fill="none">
                <path d="M3.5 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          ) : (
            <span className="w-5 shrink-0" />
          )}

          {/* Main click area */}
          <button
            onClick={onClick}
            className={clsx(
              'flex-1 flex items-center gap-2 py-1.5 pr-1 text-sm transition-colors text-left min-w-0',
              active ? 'text-brand font-semibold' : 'text-ink-mid hover:text-ink'
            )}
          >
            {depth === 0 && <span className="shrink-0">{getCategoryIcon(name)}</span>}
            <span className="truncate">{name}</span>
            <span className={clsx('ml-auto shrink-0 text-xs tabular-nums font-mono', active ? 'text-brand' : 'text-ink-low')}>
              {count}
            </span>
          </button>

          {/* Hover actions */}
          {!isProtected && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0 pr-1">
              {depth === 0 && onAdd && (
                <button
                  onClick={onAdd}
                  title="Add subcategory"
                  className="w-5 h-5 flex items-center justify-center rounded text-ink-low hover:text-ink hover:bg-float transition-colors"
                >
                  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                    <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
              <button
                onClick={() => { setEditVal(name); setEditing(true) }}
                title="Rename"
                className="w-5 h-5 flex items-center justify-center rounded text-ink-low hover:text-ink hover:bg-float transition-colors"
              >
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                  <path d="M2 10l2-1 5-5-1-1-5 5-1 2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                </svg>
              </button>
              <button
                onClick={() => setConfirming(true)}
                title="Delete"
                className="w-5 h-5 flex items-center justify-center rounded text-ink-low hover:text-red-400 hover:bg-float transition-colors"
              >
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                  <path d="M2 3h8M5 3V2h2v1M4 3l.5 7h3L8 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation tooltip */}
      {confirming && (
        <div className="mx-2 mb-1 p-2 bg-float border border-wire rounded-lg text-xs text-ink-mid">
          <p className="mb-1.5 font-medium text-ink">Delete "{name}"?</p>
          <p className="text-ink-low mb-2">
            {depth === 0
              ? 'Bookmarks will move to Uncategorized.'
              : `Bookmarks will move to ${name}'s parent.`}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { onDelete(); setConfirming(false) }}
              className="px-2 py-1 bg-red-500/10 text-red-400 rounded-md hover:bg-red-500/20 transition-colors"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-2 py-1 hover:bg-wire rounded-md text-ink-mid transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

### Inline add input component

```jsx
function AddInput({ placeholder, onAdd, onCancel }) {
  const [val, setVal] = useState('')
  const ref = useRef(null)
  useEffect(() => ref.current?.focus(), [])

  const commit = () => {
    const trimmed = val.trim()
    if (trimmed) onAdd(trimmed)
    else onCancel()
  }

  return (
    <div className="px-2 py-1">
      <input
        ref={ref}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') onCancel()
        }}
        onBlur={onCancel}
        placeholder={placeholder}
        className="w-full bg-float border border-brand rounded-md px-2 py-1 text-sm text-ink placeholder-ink-low outline-none"
      />
    </div>
  )
}
```

### Updated Sidebar export — replace the nav section

```jsx
export function Sidebar({
  bookmarks, meta,
  category, setCategory,
  subcategory, setSubcategory,
  selectedTags, setSelectedTags,
  syncing, onSync,
  collapsed,
  categories,           // from useCategories
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
}) {
  const [expandedCats, setExpandedCats] = useState({})
  const [addingTop, setAddingTop] = useState(false)
  const [addingSub, setAddingSub] = useState(null) // parent name or null

  const toggleExpand = (name) =>
    setExpandedCats(prev => ({ ...prev, [name]: !prev[name] }))

  const tagCounts = bookmarks.reduce((acc, b) => {
    b.tags?.forEach(t => { acc[t] = (acc[t] || 0) + 1 })
    return acc
  }, {})
  const sortedTags = Object.entries(tagCounts).sort(([,a],[,b]) => b-a).slice(0, 20)

  const allCount = bookmarks.filter(b => !b.archived).length

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Logo — same as before */}
      <div className={clsx('shrink-0 flex items-center py-5', collapsed ? 'justify-center px-0' : 'px-4 gap-2.5')}>
        <div className="w-7 h-7 rounded-lg bg-brand-wash flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-brand" viewBox="0 0 16 16" fill="none">
            <path d="M3 2h10a1 1 0 0 1 1 1v11l-6-3.5L2 14V3a1 1 0 0 1 1-1z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className={clsx('font-semibold text-ink text-[15px] tracking-tight transition-[opacity] duration-150 whitespace-nowrap', collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100')}>
          Booked
        </span>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto scrollbar-thin pb-2 space-y-0.5 px-2">
        {!collapsed && <p className="px-2.5 text-[10px] font-semibold uppercase tracking-widest text-ink-low mb-2 pt-1">Library</p>}
        {collapsed && <div className="h-2" />}

        {/* All */}
        <NavItem
          label="All"
          count={allCount}
          active={category === 'All'}
          onClick={() => { setCategory('All'); setSubcategory(null) }}
          icon={getCategoryIcon('All')}
          collapsed={collapsed}
        />

        {/* Category tree */}
        {categories.map(cat => (
          <div key={cat.name}>
            <CategoryRow
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
              collapsed={collapsed}
            />

            {/* Subcategories */}
            {!collapsed && expandedCats[cat.name] && (
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
                {/* Inline add subcategory input */}
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

        {/* Add top-level category */}
        {!collapsed && (
          addingTop ? (
            <AddInput
              placeholder="Category name…"
              onAdd={(name) => { onCreateCategory(name); setAddingTop(false) }}
              onCancel={() => setAddingTop(false)}
            />
          ) : (
            <button
              onClick={() => setAddingTop(true)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-ink-low hover:text-ink-mid hover:bg-float transition-colors"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Add category
            </button>
          )
        )}

        {/* Tags — same as before */}
        {!collapsed && sortedTags.length > 0 && (
          <>
            <div className="border-t border-wire-dim my-3 mx-1" />
            <p className="px-2.5 text-[10px] font-semibold uppercase tracking-widest text-ink-low mb-2">Tags</p>
            {sortedTags.map(([tag, count]) => (
              <NavItem
                key={tag}
                label={`#${tag}`}
                count={count}
                active={selectedTags.includes(tag)}
                onClick={() => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                icon={TAGS_ICON}
                collapsed={false}
              />
            ))}
          </>
        )}

        {collapsed && sortedTags.length > 0 && (
          <>
            <div className="border-t border-wire-dim my-2 mx-2" />
            <Tip label="Tags" collapsed>
              <button className="w-full flex justify-center p-2.5 rounded-lg text-ink-low hover:text-ink-mid hover:bg-float transition-colors">
                {TAGS_ICON}
              </button>
            </Tip>
          </>
        )}
      </div>

      {/* Footer (ThemePicker + Sync) — same as before */}
      <div className={clsx('shrink-0 border-t border-wire-dim pt-3 space-y-1', collapsed ? 'px-2' : '')}>
        <ThemePicker collapsed={collapsed} />
        <div className={clsx('pb-4', collapsed ? 'px-0' : 'px-3')}>
          <Tip label={syncing ? 'Syncing…' : 'Sync bookmarks'} collapsed={collapsed}>
            <button
              onClick={() => onSync({ range: 'sync' })}
              disabled={syncing}
              className={clsx('flex items-center gap-2 rounded-lg text-xs font-medium bg-float hover:bg-wire/10 text-ink-mid hover:text-ink border border-wire transition-all disabled:opacity-50', collapsed ? 'w-full justify-center p-2.5' : 'w-full px-3 py-2')}
            >
              {SYNC_ICON(syncing)}
              <span className={clsx('transition-[opacity] duration-150 whitespace-nowrap', collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100')}>
                {syncing ? 'Syncing…' : 'Sync bookmarks'}
              </span>
            </button>
          </Tip>
        </div>
      </div>
    </div>
  )
}
```

**Commit:**
```bash
git add client/src/components/Sidebar.jsx
git commit -m "feat: sidebar category tree with inline CRUD"
```

---

## Task 8: BookmarkDetail subcategory select

**Files:**
- Modify: `client/src/components/BookmarkDetail.jsx`

Add `categories` prop. Below the Category `<select>`, add:

```jsx
// Add to prop list: categories = []
// After the category select block:

{(() => {
  const parentCat = categories.find(c => c.name === category)
  if (!parentCat || parentCat.children.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>Subcategory</SectionLabel>
      <select
        value={subcategory || ''}
        onChange={e => {
          const val = e.target.value || null
          setSubcategory(val)
          save({ subcategory: val })
        }}
        className="field"
      >
        <option value="">— None —</option>
        {parentCat.children.map(sub => (
          <option key={sub.name} value={sub.name}>{sub.name}</option>
        ))}
      </select>
    </div>
  )
})()}
```

Also add `subcategory` state:
```jsx
const [subcategory, setSubcategory] = useState(null)
// In useEffect, add:
setSubcategory(bookmark.subcategory || null)
```

**Commit:**
```bash
git add client/src/components/BookmarkDetail.jsx
git commit -m "feat: subcategory select in BookmarkDetail"
```

---

## Task 9: BookmarkCard subcategory badge

**Files:**
- Modify: `client/src/components/BookmarkCard.jsx`

In the footer row, after the category badge span, add:

```jsx
{bookmark.subcategory && (
  <span className="text-[11px] px-2 py-0.5 rounded-md text-ink-low bg-float font-medium">
    {bookmark.subcategory}
  </span>
)}
```

**Commit:**
```bash
git add client/src/components/BookmarkCard.jsx
git commit -m "feat: show subcategory badge on BookmarkCard"
```

---

## Task 10: Build + final verification

```bash
# Run all server tests
cd /Users/tyler/Development/Booked/server && npm test

# Build client
cd /Users/tyler/Development/Booked/client && npx vite build

# Start the app and manually verify:
cd /Users/tyler/Development/Booked && npm run dev
```

Manual checklist:
- [ ] Sidebar shows category tree (chevron expands Dev → Frontend, Backend)
- [ ] Hover a category row → `+`, pencil, trash icons appear
- [ ] Click `+` on Dev → inline input appears indented, Enter adds subcategory
- [ ] Click `+ Add category` → top-level inline input appears
- [ ] Rename works in-place (Enter to save, Esc to cancel)
- [ ] Delete shows confirmation tooltip with cascade warning
- [ ] Sidebar collapses → icon rail still shows, subcategories not visible (expected)
- [ ] BookmarkDetail: subcategory dropdown appears when parent has children
- [ ] BookmarkCard: subcategory badge shows when set
- [ ] Filter works: clicking "Dev" shows all Dev bookmarks; clicking "Frontend" filters to sub

**Final commit:**
```bash
git add client/dist/
git commit -m "chore: production build with nested category UI"
```

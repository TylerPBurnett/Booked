# Categories & Subcategories Reference

**Last updated:** 2026-03-03
**Status:** Implemented and stable

This document is the authoritative reference for the categories/subcategories feature. Use it when adding new features, debugging, or refactoring. The session log at `docs/2026-03-03-nested-categories-session.md` has the full implementation history.

---

## Data Model

### `data/meta.json`

Categories are stored as an ordered array of objects. Order in the array is the display order in the sidebar.

```json
{
  "lastSyncedAt": "2026-03-03T00:00:00Z",
  "totalBookmarks": 120,
  "categories": [
    { "name": "Design",  "children": [] },
    { "name": "Dev",     "children": ["Frontend", "Backend"] },
    { "name": "Reads",   "children": [] },
    { "name": "Uncategorized", "children": [] }
  ]
}
```

**Rules:**
- `"Uncategorized"` is a reserved system category. It cannot be renamed, deleted, or moved. It must always be last in the array.
- Top-level `name` values must be unique across the entire tree (including subcategory names).
- `children` is an array of **strings** (not objects) — just the subcategory names.
- Subcategory names must be unique within their parent's `children` array. The server also enforces global uniqueness via `flattenCategories`.

### Bookmark fields

Each bookmark in `data/bookmarks.json` has two classification fields:

```json
{
  "category": "Dev",
  "subcategory": "Frontend"
}
```

- `category` — always a top-level category name (string, required).
- `subcategory` — a subcategory name within the parent, or `null` / absent (optional).
- A bookmark with `subcategory: "Frontend"` and `category: "Dev"` is counted in both `Dev` and `Frontend`.

---

## Server

### `server/data.js` — Pure helpers

All category mutations are pure functions that take `meta` and return a new `meta`. They never write to disk directly.

| Function | Signature | Description |
|----------|-----------|-------------|
| `migrateMeta(raw)` | `raw → meta` | Migrates old flat string array format to the new `{ name, children[] }` format. Called automatically by `readMeta()`. Safe to call on already-migrated data. |
| `flattenCategories(meta)` | `meta → string[]` | Returns a flat list of all names (top-level + subcategory). Used for uniqueness checks. |
| `addCategory(meta, name, parent?)` | `meta → meta` | Adds a top-level category (no parent) or a subcategory (parent = parent name). Throws if name already exists. |
| `removeCategory(meta, name, parent?)` | `meta → meta` | Removes a top-level category or subcategory. Throws if trying to remove `"Uncategorized"`. Cascade to bookmarks is done at the route level, not here. |
| `renameCategory(meta, oldName, newName, parent?)` | `meta → meta` | Renames a category or subcategory. Throws if trying to rename `"Uncategorized"`. Cascade to bookmarks is done at the route level. |
| `reorderCategories(meta, nameOrder)` | `meta → meta` | Rewrites the categories array in the given order. Validates: correct count, no duplicates, all names exist, `"Uncategorized"` is last. |

**Important:** `addCategory` throws with a generic error for any duplicate. The route handler maps this to a 409.

### `server/routes/categories.js` — REST endpoints

Base path: `/api/categories` (mounted in `server/index.js`)

#### `GET /api/categories`

Returns the full category tree with live bookmark counts.

```json
[
  { "name": "Design",  "count": 42, "children": [] },
  { "name": "Dev",     "count": 18, "children": [
    { "name": "Frontend", "count": 11 },
    { "name": "Backend",  "count":  7 }
  ]},
  { "name": "Uncategorized", "count": 5, "children": [] }
]
```

`count` on a parent = all bookmarks where `b.category === name` (includes those with any subcategory).
`count` on a subcategory = bookmarks where `b.category === parent && b.subcategory === sub`.

#### `POST /api/categories`

Create a top-level or subcategory.

```json
// Top-level
{ "name": "AI" }

// Subcategory under Dev
{ "name": "Infrastructure", "parent": "Dev" }
```

- `201` on success: `{ "name": "...", "parent": "..." | null, "children": [] }`
- `400` if `name` is missing
- `409` if name already exists anywhere in the tree

#### `PATCH /api/categories/:name`

Rename a category or subcategory. Cascades to all matching bookmarks.

```json
// Rename top-level
PATCH /api/categories/AI
{ "name": "Artificial Intelligence" }

// Rename subcategory (must pass parent)
PATCH /api/categories/Frontend
{ "name": "FE", "parent": "Dev" }
```

- `200` on success: `{ "name": "...", "parent": "..." | null }`
- `400` if `name` is missing or trying to rename `"Uncategorized"`

#### `DELETE /api/categories/:name`

Delete a category or subcategory. Cascades to bookmarks.

```
// Delete top-level (bookmarks → Uncategorized)
DELETE /api/categories/AI

// Delete subcategory (bookmarks → parent category, subcategory set to null)
DELETE /api/categories/Frontend?parent=Dev
```

- `200`: `{ "ok": true }`
- `400` if trying to delete `"Uncategorized"`

#### `PUT /api/categories/reorder`

Reorder top-level categories.

```json
{ "order": ["Reads", "Dev", "Design", "Uncategorized"] }
```

- Must include **all** category names exactly once
- `"Uncategorized"` must be last
- `200`: `{ "ok": true }`
- `400` on any validation failure

---

## Client

### `client/src/hooks/useCategories.js`

Manages the category tree state. Loaded once at app start in `App.jsx`.

```js
const {
  categories,           // { name, count, children: [{ name, count }] }[]
  createCategory,       // (name, parent?) => Promise<void>
  renameCategory,       // (oldName, newName, parent?) => Promise<void>
  deleteCategory,       // (name, parent?) => Promise<void>
  reorderCategories,    // (nameOrder: string[]) => Promise<void> — optimistic
  refetch,              // () => Promise<void>
} = useCategories()
```

`reorderCategories` is **optimistic** — it updates local state immediately and fires the API in the background. On failure, it reverts via `refetch`.

`createCategory`, `renameCategory`, `deleteCategory` are all fire-and-refetch (not optimistic).

### `client/src/hooks/useFilters.js`

`subcategory` state resets to `null` automatically when `category` changes (via `useEffect`).

```js
const {
  category, setCategory,
  subcategory, setSubcategory,   // null means "show all in category"
  ...
} = useFilters(bookmarks)
```

Filter logic: if `category !== 'All'`, filter by `b.category === category`. If `subcategory` is set, additionally filter by `b.subcategory === subcategory`.

### `client/src/components/Sidebar.jsx`

The sidebar renders a collapsible tree for categories.

**State:**
- `expandedCats: { [name]: boolean }` — which top-level categories are expanded
- `addingTop: boolean` — whether the "Add category" input is visible
- `addingSub: string | null` — which parent's "Add subcategory" input is active

**Key behaviors:**
- Every depth-0 category has an expand chevron (even empty ones — so the "+ Add subcategory" button is always reachable)
- When expanded, subcategories are listed with a persistent **"+ Add subcategory"** button at the bottom
- `"Uncategorized"` is always rendered outside `DndContext` / `SortableContext` — it cannot be dragged
- Collapsed sidebar (icon rail): depth > 0 rows return `null` (subcategories are hidden)
- Drag-to-reorder is only enabled when `!collapsed` and only for depth-0 non-Uncategorized categories

### `client/src/components/BookmarkDetail.jsx`

The slide-out panel for editing a bookmark.

- Category `<select>` is populated from the `categories` prop (dynamic, not hardcoded)
- When category changes, `subcategory` is reset to `null` immediately in local state and saved via `PATCH`
- Subcategory `<select>` only appears when the selected category has `children.length > 0`
- Subcategory `<select>` option value `""` maps to `null` (the "— None —" option clears subcategory)

### `client/src/components/BookmarkCard.jsx`

Shows a secondary badge for subcategory when `bookmark.subcategory` is set.

---

## Known Behaviors & Edge Cases

**Subcategory counts don't show on the parent row in sidebar.**
The `count` on a parent in `GET /api/categories` already counts all bookmarks including subcategory ones. But the sidebar shows that count on the parent row. Clicking a parent (with no subcategory selected) shows ALL bookmarks in that category including those with subcategories — this is consistent.

**Renaming a parent category cascades to bookmarks.**
`PATCH /api/categories/:name` (no `parent` param) updates all `b.category === oldName` bookmarks in the route handler. The data helper only updates the meta structure.

**Deleting a parent cascades bookmarks to `"Uncategorized"`.**
If `Dev` is deleted, all bookmarks with `category: "Dev"` get `category: "Uncategorized"`, `subcategory: null`. This is done in the route handler, not in the data helper.

**Auto-sync doesn't re-classify existing bookmarks.**
When you add/rename/delete categories, existing bookmarks are not re-classified by the AI. Only newly synced bookmarks get classified. To re-classify, you'd need a separate batch operation.

**The AI classifier returns `{ category, subcategory, tags }`.**
It receives the live category tree during sync and returns valid names or falls back to `"Uncategorized"` / `null`. See `server/classifier.js`.

---

## Testing

```bash
cd server && npx vitest run
```

- `server/data.test.js` — 21 unit tests for all pure helper functions
- `server/api.test.js` — 20 integration tests for all REST endpoints

Tests use an isolated temp directory (`process.env.BOOKED_DATA_DIR`) — they never touch `data/bookmarks.json` or `data/meta.json`.

---

## How to Extend

**Add a new category mutation (e.g. "move subcategory to top-level"):**
1. Add a pure helper in `server/data.js` (take `meta`, return new `meta`)
2. Add tests in `server/data.test.js`
3. Add a route in `server/routes/categories.js` (validate, call helper, write, cascade bookmarks if needed)
4. Add API test in `server/api.test.js`
5. Add method to `useCategories.js`
6. Wire into `App.jsx` and pass to `Sidebar`

**Add subcategory-level drag-to-reorder:**
Currently only top-level categories are reorderable. To extend, you'd need:
- A `reorderSubcategories(meta, parent, nameOrder)` helper
- A new endpoint (e.g. `PUT /api/categories/:name/reorder`)
- Nested `SortableContext` inside the expanded children block in `Sidebar.jsx`

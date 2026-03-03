# Nested Category Management Design

**Date:** 2026-03-03
**Status:** Approved

## Summary

Add full category/subcategory CRUD to the Booked sidebar. Users can create, rename, and delete categories and subcategories inline — Notion-style — without leaving their browsing context. The AI classifier is made dynamic so new bookmarks are classified into custom categories automatically.

---

## Data Model

### `data/meta.json` — categories field

Old (flat strings):
```json
{ "categories": ["Design", "Dev", "Uncategorized"] }
```

New (nested objects):
```json
{
  "categories": [
    { "name": "Dev",    "children": ["Frontend", "Backend", "DevOps"] },
    { "name": "Design", "children": [] },
    { "name": "Reads",  "children": [] },
    { "name": "Uncategorized", "children": [] }
  ]
}
```

The server auto-migrates old flat arrays to the new format on first read (backward compatible).

### `data/bookmarks.json` — each bookmark

Gains an optional `subcategory` field (null if unset, no migration needed):
```json
{ "category": "Dev", "subcategory": "Frontend" }
```

**Rules:**
- `"Uncategorized"` is protected — cannot be renamed or deleted.
- Deleting a parent category cascades all its bookmarks to `Uncategorized`.
- Deleting a subcategory cascades those bookmarks to the parent category (subcategory set to null).
- Renaming cascades to all matching bookmarks.

---

## API — New Resource: `/api/categories`

RESTful CRUD on categories as a first-class resource.

| Method | Endpoint | Body | Effect |
|---|---|---|---|
| `GET` | `/api/categories` | — | Returns full tree with per-category bookmark counts |
| `POST` | `/api/categories` | `{ name, parent? }` | Creates top-level category or subcategory under `parent` |
| `PATCH` | `/api/categories/:name` | `{ name: newName }` | Renames; cascades to all affected bookmarks |
| `DELETE` | `/api/categories/:name` | — | Deletes; cascades bookmarks as described above |

The existing `PATCH /api/meta` remains but is only used for non-category meta fields.

---

## AI Classifier Changes (`server/classifier.js`)

The hardcoded category list is removed. Instead:

- `classifyBookmark(text, authorHandle, categories)` accepts the live category tree.
- The prompt is built dynamically from the full flat name list (parents + children).
- Response shape expands to `{ category, subcategory }` — subcategory is `null` when the tweet only fits a top-level.
- The sync route (`routes/sync.js`) reads the current category tree and passes it to `classifyBatch`.

---

## Client Changes

### New hook: `useCategories.js`
Manages the category tree state with optimistic updates. Exposes:
- `categories` — full nested tree
- `createCategory(name, parent?)`, `renameCategory(name, newName)`, `deleteCategory(name)`
- `refetch()` — sync from server

### `useFilters.js`
- Add `subcategory` filter state (null = all subs of current category).
- Filtering: if `subcategory` set, filter by both `category === cat && bookmark.subcategory === sub`; else filter by `category === cat` (matches all subs).

### `Sidebar.jsx` — tree nav
- Each parent has a `▸/▾` chevron button to expand/collapse its children.
- Hover any row → ghost `+` (add subcategory) and `···` (Rename / Delete menu) appear on the right.
- Click `+ Add category` at the bottom → inline input for new top-level.
- Click row `+` → inline input indented below the parent.
- Rename: label becomes an editable input in-place (Enter = save, Esc = cancel).
- Delete: small inline confirmation tooltip with cascade warning + Confirm/Cancel.
- Collapsed icon-rail: top-level icons only; subcategories not accessible (expected trade-off).

### `BookmarkDetail.jsx`
- Category `<select>` stays.
- A second `<select>` for subcategory appears beneath it, populated from the selected parent's children. Hidden if the selected parent has no children.

### `BookmarkCard.jsx`
- Optionally show subcategory tag alongside the category badge (only if subcategory is set).

---

## Files Changed

**Server:**
- `server/data.js` — migrate old format, expose category helpers
- `server/classifier.js` — dynamic categories, return `{ category, subcategory }`
- `server/routes/categories.js` — NEW: REST CRUD
- `server/routes/sync.js` — pass category tree to classifier
- `server/index.js` — mount `/api/categories`

**Client:**
- `client/src/hooks/useCategories.js` — NEW
- `client/src/hooks/useFilters.js` — add subcategory filter
- `client/src/App.jsx` — wire `useCategories`, pass to Sidebar + BookmarkDetail
- `client/src/components/Sidebar.jsx` — tree nav with inline CRUD
- `client/src/components/BookmarkDetail.jsx` — subcategory select
- `client/src/components/BookmarkCard.jsx` — subcategory badge

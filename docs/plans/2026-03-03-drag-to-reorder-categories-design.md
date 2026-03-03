# Drag-to-Reorder Categories Design

**Date:** 2026-03-03
**Status:** Approved

## Summary

Allow users to reorder top-level sidebar categories by dragging. Subcategories remain locked within their parent. Order is persisted to `data/meta.json` immediately.

---

## Library

**`@dnd-kit/core` + `@dnd-kit/sortable`**

- React 18 compatible, no StrictMode issues
- Composable hooks (`useSortable`, `DndContext`, `SortableContext`)
- Built-in keyboard support (accessibility)
- Drag overlay API for visual ghost element
- ~4kb gzipped combined
- Used by Vercel, Shopify, Loom

---

## Data Model

No schema change. Category order is already the array order in `meta.json`. A new endpoint writes the reordered array.

---

## API

### `PUT /api/categories/reorder`

**Body:** `{ order: ['Design', 'Dev', 'Reads', ...] }`

- Validates every name in `order` exists in the current category tree
- Rewrites `meta.categories` preserving each category object (with its `children`), in the new order
- Returns `200 { ok: true }` or `400` if names don't match

---

## UX

- A grip handle icon (⠿) appears on **hover** at the far left of each top-level category row (excluding `Uncategorized` and `All`)
- The handle is the drag initiator — clicking the row still navigates, clicking the handle starts drag
- During drag: dragged row renders at 40% opacity in-place; a full-opacity drag overlay follows the cursor
- On drop: `arrayMove` reorders local state immediately (optimistic), then `PUT /api/categories/reorder` fires in the background
- `Uncategorized` is always pinned to the bottom — it never gets a handle and cannot be moved
- Collapsed sidebar: drag is disabled (icon rail has no drag handles)

---

## Files Changed

**Server:**
- `server/data.js` — add `reorderCategories(meta, nameOrder)` pure helper
- `server/routes/categories.js` — add `PUT /` route
- `server/api.test.js` — add test for `PUT /api/categories/reorder`

**Client:**
- `client/package.json` — add `@dnd-kit/core`, `@dnd-kit/sortable`
- `client/src/hooks/useCategories.js` — add `reorderCategories(nameOrder)` method
- `client/src/components/Sidebar.jsx` — wrap list in `DndContext` + `SortableContext`; add drag handle + `useSortable` to `CategoryRow`

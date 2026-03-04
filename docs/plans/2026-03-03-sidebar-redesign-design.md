# Sidebar Redesign Design

**Date:** 2026-03-03

## Goals
Modernize sidebar UX with Raindrop-style interactions, better visual hierarchy, category customization (icon + color), animated expand/collapse, and relocated theme picker.

## Changes

### 1. Raindrop-style count/menu swap
- Category rows show bookmark count on right by default
- On hover: count fades out, 3-dot `...` button fades in (same position)
- Click opens dropdown menu: Rename, Add subcategory, Change icon, Change color, Delete
- Subcategory rows: simpler menu (Rename, Delete)
- "All" and "Uncategorized" are protected — no menu

### 2. Category icons & colors
- Categories store optional `icon` (emoji) and `color` (hex)
- Defaults: folder SVG icon, no color
- Emoji replaces SVG icon when set; color shows as tint/dot
- Data model: extend `useCategories` → `updateCategory(name, { icon, color })`
- Server: PATCH `/api/categories/:name` accepts `icon` and `color` fields

### 3. Better visual hierarchy
- "Library" section header gets `+` button on right to add category
- Remove full-width "Add category" button row
- Tighter item spacing, larger section header padding

### 4. Expand/collapse animation
- Subcategory trees animate height with CSS transition (~150ms ease-out)
- Use `max-height` or ref-based measurement

### 5. Theme picker → TopBar
- Remove `ThemePicker` from sidebar footer
- Add palette icon button in TopBar → opens theme grid dropdown
- Sidebar footer becomes just the sync button (more compact)

### 6. Cleaner sidebar footer
- Sync button only, reduced padding

## Data Model Changes
Categories gain `icon` (string|null) and `color` (string|null) fields. Server PATCH endpoint extended. `useCategories` hook gets `updateCategory` method.

## Files Affected
- `client/src/components/Sidebar.jsx` — major rework
- `client/src/components/TopBar.jsx` — add theme picker
- `client/src/hooks/useCategories.js` — add updateCategory
- `server/index.js` (or routes) — extend PATCH endpoint
- `client/src/index.css` — any new animation utilities

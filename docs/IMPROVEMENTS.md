# Booked — Recommended Features & Improvements

Ordered roughly by impact-to-effort ratio. Items near the top deliver the most value with the least complexity.

---

## Recently Completed

- **Date fix** — `bookmarkedAt` fell back to `new Date()` (sync time) when X didn't return `bookmarked_at`. Now falls back to `postedAt` (tweet date). 5,066 existing records migrated.
- **500-bookmark cap removed** — client now fetches up to 10,000 bookmarks. Grid renders in pages of 100 via IntersectionObserver infinite scroll.
- **Saved-order model** — Added immutable local fields (`savedAt`, `savedSeq`) so Booked can sort by when items were first seen in the app. `Saved (newest)` is now the default sort.
- **Incremental sync fix** — `--sync` now stops based on a streak of already-known bookmark IDs instead of tweet dates, so newly-bookmarked older posts are no longer skipped.
- **Sidebar collapse** — collapsible sidebar with localStorage persistence added.
- **Theme system** — `ThemeProvider` context wired in; dark/light groundwork laid.

---

## High Priority

### 0. Reddit Saved Posts

**What:** Pull saved posts and comments from Reddit into the same library as X bookmarks. Cards show subreddit, title, score, and a link. Category/tag/notes system applies identically.

**Why:** Reddit saved posts are the other major "read-it-later" bucket for most users. A unified library across both sources is the core value proposition of Booked as a multi-source tool.

**Implementation:**
- OAuth2 with Reddit API (`/api/v1/me/saved`) — standard PKCE flow, token stored in `data/reddit-session.json`
- `server/reddit-scraper.js` — pages through saved items, maps to Booked bookmark schema with `source: 'reddit'`
- Add `source` field to bookmark schema (`'x' | 'reddit'`) for filtering
- Source filter pill in sidebar (All / X / Reddit)
- Sync route extended: `POST /api/sync` accepts `{ source: 'reddit' }` or syncs both by default

---

### 1. Post-Sync Triage Inbox

**What:** After a sync completes, a focused "New" view appears showing only the bookmarks just added. Each card shows the AI-suggested category and tags pre-filled, with a quick way to confirm or override before moving on. Once triaged, the bookmark graduates to the main library. A "Skip — trust AI" button dismisses the inbox without reviewing.

**Why:** Auto-classification during sync is the right default — it's fast and non-blocking. But the AI picks from a fixed taxonomy without knowing your mental model. The inbox gives you a natural "triage on your own schedule" moment: you can process it right away or come back later. It also makes the AI suggestion feel collaborative rather than prescriptive.

**Implementation:**
- Track `syncedAt` timestamp on each bookmark (already set during upsert)
- `useBookmarks` exposes a derived `unreviewed` list — bookmarks where `syncedAt` is after `lastTriagedAt` in `meta.json`
- After sync, the app automatically navigates to or highlights an "Inbox" tab in the sidebar
- Inbox view: same card layout, but with category/tag fields expanded inline for fast editing
- "Mark all reviewed" and "Skip — trust AI" buttons write `lastTriagedAt` to meta
- Badge on the sidebar Inbox item shows unreviewed count

---

### 2. Bulk Tag Operations

**What:** Shift+click to multi-select cards. When multiple cards are selected, a floating action bar appears with options to bulk-assign a category, add a tag to all selected, archive selected, or export selected.

**Why:** The single biggest UX gap right now. Importing 500 bookmarks and tagging them one by one is unusable. Bulk ops turn the app from a viewer into a real management tool.

**Implementation:**
- Add `selectedIds: Set<string>` state in `App.jsx`
- Shift+click on `BookmarkCard` toggles inclusion in set
- Floating `BulkActionBar` component renders when `selectedIds.size > 0`
- Bulk PATCH: `Promise.all(selectedIds.map(id => updateBookmark(id, patch)))`
- Add `POST /api/bookmarks/bulk` endpoint for atomic server-side bulk update

---

### 2. Keyboard Navigation

**What:** Arrow keys to move between cards, `Enter` to open detail, `Escape` to close, `t` to focus tag input, `c` to change category, `a` to archive. A `?` overlay shows all shortcuts.

**Why:** Power users manage bookmarks at speed with keyboard. Mouse-only interaction slows the workflow significantly.

**Implementation:**
- `useKeyboard` hook with `useEffect` on `keydown`
- Track `focusedIndex` alongside `selectedId`
- `BookmarkCard` accepts `focused` prop (ring highlight style)
- `?` keystroke toggles `KeyboardHelpModal`

---

### 3. Tag Autocomplete in Detail Drawer

**What:** When typing in the "Add tag" input of `BookmarkDetail`, show a dropdown of existing tags that fuzzy-match what you're typing. Click or arrow-key to select.

**Why:** Prevents tag fragmentation (e.g., "react", "React", "reactjs" all as separate tags). Autocomplete enforces consistency without forcing the user to remember exact spellings.

**Implementation:**
- Collect all unique tags from bookmarks in `useBookmarks` (memoized)
- Pass to `BookmarkDetail` via App.jsx
- Fuse.js search on the tag list as user types
- `Combobox` component (dropdown anchored below input)

---

### 4. Tag & Category Management Screen

**What:** A dedicated settings panel (accessible from the sidebar or ⚙ icon) for:
- Rename a tag across all bookmarks
- Merge two tags into one
- Delete a tag (with count of affected bookmarks)
- Reorder categories via drag-and-drop
- Add a new custom category

**Why:** Tags accumulate drift over time. The API endpoints for rename/delete already exist — just need a UI.

**Implementation:**
- `SettingsModal` component triggered by a gear icon in the sidebar footer
- Tag list with usage counts, inline rename input, merge dropdown, delete with confirm
- Category list with drag handle (`@dnd-kit/sortable` or similar)
- Wire to existing `POST /api/meta/tags/rename` and `POST /api/meta/tags/delete`

---

### 5. Persistent Filter State

**What:** Save the user's last-used category, tags, sort order, and time range to `localStorage`. When the app reloads, restore those filters automatically.

**Why:** Users have a home base — the category they work in most, the sort order they prefer. Having to re-apply filters every time is friction.

**Implementation:**
- In `useFilters`, wrap `useState` initializers to read from `localStorage`
- Add a `useEffect` that writes current filter state to `localStorage` on change
- Simple JSON serialization: `localStorage.setItem('booked:filters', JSON.stringify({...}))`

---

## Medium Priority

### 6. Collections / Smart Folders

**What:** User-defined saved searches. A collection is a name + set of filter criteria (category, tags, time range, has media). Collections appear in the sidebar above or below the main category list. Clicking a collection applies all its filters instantly.

**Why:** Power users develop repeating workflows — "my design system references", "threads about React", "things to read this weekend". Collections let them one-click into those views.

**Implementation:**
- Add `collections` array to `meta.json`
- `Collection` object: `{ id, name, filters: { category?, tags?, timeRange?, hasMediaOnly? } }`
- `useFilters` accepts initial filter override from clicked collection
- `SaveFilterButton` in TopBar saves current filter state as a new collection

---

### 7. Export

**What:** Export bookmarks to common formats. Options:
- **JSON** — full records, for backup or import elsewhere
- **CSV** — for spreadsheets (URL, text, author, tags, date)
- **Markdown** — a reading list format: `## Category\n- [tweet text](url) — @handle`
- **Pocket/Raindrop import format** — for migrating to another tool

**Why:** Data portability. Users shouldn't feel locked in. Also useful for sharing curated lists.

**Implementation:**
- `GET /api/bookmarks/export?format=json|csv|markdown` endpoint
- Client-side `ExportMenu` button in the TopBar
- For markdown: group by category, sort by date, render text with link and handle

---

### 8. Re-classify Selected Bookmarks

**What:** Select one or more bookmarks and trigger re-classification via the "Run AI" option in the bulk action bar. Re-runs `classifyBatch` on the selected records and updates their `category` and `aiSuggestedTags` (but not user-set `tags`).

**Why:** The AI classifier uses the tweet text at import time. For bookmarks imported before the API key was set (classified as Uncategorized), or for bookmarks where the auto-classification was wrong, this lets the user trigger a fresh pass.

**Implementation:**
- `POST /api/bookmarks/reclassify` — accepts array of IDs, runs classifier, updates records, returns updated bookmarks
- Add "Run AI ✨" to the bulk action bar
- Could also be a single-bookmark action in the detail drawer footer

---

### 9. Sync Status + History

**What:** A small sync history panel showing the last 10 syncs: timestamp, how many new bookmarks were added, and duration. Accessible from a status indicator in the sidebar near the sync button.

**Why:** It's currently opaque whether sync worked. A minimal history gives confidence and helps diagnose problems ("why didn't my bookmarks from yesterday show up?").

**Implementation:**
- `syncs` array in `meta.json` — last 10 sync events: `{ syncedAt, newBookmarks, totalScraped, durationMs }`
- `sync.js` route writes to this array before responding
- Small `SyncHistory` panel in sidebar (collapsible, under sync button)

---

### 10. Full-Text Search on Server

**What:** Move search to the server with proper full-text indexing. Client still sends queries, but via `GET /api/bookmarks?q=query`. Results come back pre-ranked.

**Why:** Fuse.js on 500 bookmarks is fast. On 5,000 it starts to lag. Server-side search with a proper index (SQLite FTS5, or even just a pre-built inverted index) scales better.

**Implementation:**
- The `?q` query param is already stubbed in `routes/bookmarks.js` — just needs the implementation
- Easiest path: SQLite with FTS5 (replace flat JSON, use `better-sqlite3`)
- Alternative: keep JSON but build an in-memory inverted index on server startup

---

### 11. Duplicate Detection

**What:** When the same URL is bookmarked multiple times (possible if a tweet was un-bookmarked and re-bookmarked), detect the duplicate and surface it in the UI with a "Merge" option.

**Why:** Subtle data quality issue. Deduplication by tweet ID handles the obvious case, but re-bookmarked tweets will have a new `bookmarkedAt` timestamp and could appear twice under edge conditions.

**Implementation:**
- During upsert, check for URL collisions in addition to ID collisions
- Surface duplicates in a `GET /api/bookmarks/duplicates` endpoint
- Small UI indicator on affected cards

---

## Lower Priority / Nice to Have

### 12. Dark/Light/System Theme Toggle

**What:** Currently hardcoded dark. Add a theme toggle (sun/moon icon in sidebar footer) that switches between dark, light, and system preference. Persist choice to `localStorage`.

**Implementation:**
- Tailwind dark mode via class strategy (`darkMode: 'class'` in tailwind.config)
- Toggle button updates `document.documentElement.classList`
- Full light theme pass over all component classes

---

### 13. Reading Mode

**What:** Click a bookmark to open a distraction-free expanded view that shows the full tweet text in a large, readable format with just the essential metadata. No sidebar, no search bar — just the content. A link to the original tweet is always visible.

**Why:** Some bookmarks are saved specifically to read later. The current detail drawer is editing-focused. A reading mode optimizes for consumption.

**Implementation:**
- Add a "Read" button/shortcut in `BookmarkDetail`
- `ReadingModal` component — full-screen overlay, large text, clean layout
- `r` keyboard shortcut when a bookmark is focused

---

### 14. Auto-Sync on Schedule

**What:** When the server starts, check if `lastSyncedAt` is older than N hours and automatically trigger a sync in the background. Show a small notification in the sidebar if new bookmarks were found.

**Why:** Removes the need to manually run `/x-bookmarks` every time. The app stays fresh automatically as long as the server is running.

**Implementation:**
- On `index.js` startup, compare `meta.lastSyncedAt` to current time
- If stale (configurable threshold, default 24h), spawn background sync
- Add `SERVER_AUTOSYNC_HOURS` env var to configure threshold (set to 0 to disable)
- Notification: `syncing` state in a top-right toast component

---

### 15. Multiple Browser Profile Support

**What:** Let the user configure which Chrome profile to use (e.g., Default, Profile 1). Currently hardcoded to `Default`.

**Why:** Some users keep separate Chrome profiles for work and personal accounts, with different X logins.

**Implementation:**
- `CHROME_PROFILE` env var (default: `Default`)
- Used in `scraper.js` `launchPersistentContext` args: `--profile-directory=${profile}`
- Document in `.env.example`

---

### 16. Bookmark Notes Search

**What:** Currently, fuzzy search includes `notes` as a search field (weight 0.05). Make notes a first-class search target — allow searching specifically within notes with a `notes:` prefix query syntax.

**Why:** Power users use notes as a personal annotation layer. Being able to search specifically within notes lets them use it as a knowledge base.

**Implementation:**
- Parse `notes:` prefix in `useFuzzySearch`
- If prefix detected, run Fuse.js against notes-only key with full weight
- Could also apply to `author:` (search only by handle) and `tag:` (search only by tag)

---

### 17. Import from Other Sources

**What:** Import bookmarks from other services:
- **Browser bookmarks** — parse Chrome/Firefox bookmark HTML export
- **Pocket export** — standard CSV/HTML format
- **Raindrop.io export** — CSV format
- **Twitter archive** — if user has downloaded their data archive

**Why:** Users switching to Booked from another tool shouldn't lose their history.

**Implementation:**
- `POST /api/import` endpoint accepting multipart file upload
- Parser modules per format (browser bookmarks HTML is well-documented)
- Map to Booked's bookmark schema (no scraping, just URL/title/date)
- Mark imported-from-elsewhere records with `source` field for transparency

---

## Technical Debt / Refactoring

### Migrate from JSON to SQLite

The flat JSON file approach works well up to ~5,000 bookmarks. Beyond that, reads are O(n) and writes require reading the entire file. SQLite with `better-sqlite3` is a zero-config embedded database that would give proper indexing and full-text search while keeping the "no setup" property. The migration path is straightforward: `data.js` is the only module that touches storage, so swapping the backend there is low-risk.

### Error States in the UI

The app currently has minimal error handling in the React client. `useBookmarks` doesn't expose an `error` state to the UI — if the server is down, the user sees a blank screen. Add `error` state to `useBookmarks` and render a proper error card when the API fails to respond.

### Virtual Scrolling for Large Libraries

`useBookmarks` fetches up to 10,000 bookmarks and the grid uses IntersectionObserver to render in pages of 100. Works well today but as the library grows past 10k, consider true virtual scrolling (`@tanstack/react-virtual`) or server-side cursor pagination. The server already supports `limit` and `offset`.

### Server Tests for Scraper + Classifier

`scraper.js` and `classifier.js` have no automated tests. The scraper is inherently integration-test territory (requires a browser), but `classifier.js` can be unit-tested by mocking the Anthropic SDK. The JSON response parsing logic in `extractBookmarksFromResponse` is pure and should have comprehensive tests — X's API response shape has multiple variants that could break parsing.

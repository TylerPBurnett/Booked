# Booked UI/UX Roadmap

Date: 2026-03-04  
Scope: UI/UX direction for an AI-assisted X bookmark reader and organizer

## Product Goal

Make Booked feel like a fast daily triage tool, not just a bookmark viewer:

- Pull new bookmarks from X quickly
- Let AI do first-pass organization
- Let users confirm or correct AI suggestions in seconds
- Keep long-term libraries easy to navigate and trustworthy

## UX Principles

1. AI suggests, user stays in control.
2. Every sync should end in a clear next action.
3. Bulk actions should be first-class for large libraries.
4. Recovery paths must be obvious (archived items, changed categories, edited tags).
5. Keyboard and mouse workflows should both be efficient.

## Now (1-2 weeks)

### 1) Post-sync Inbox

- Why: New bookmarks need a focused triage step.
- Scope:
  - Add an Inbox view for items added since the last review point.
  - Show AI category/tags inline with quick actions: Accept, Edit, Skip.
  - Add "Mark all reviewed" and "Trust AI for all" actions.
- Effort: M
- Success metric:
  - >=70% of newly synced bookmarks reviewed within 24h.
  - Lower uncategorized growth week over week.

### 2) Archive Visibility + Recovery

- Why: Archiving is useful only if retrieval is obvious.
- Scope:
  - Add "Archived" filter/view in sidebar.
  - Add clear empty states and restore action from archive views.
- Effort: S
- Success metric:
  - Archive and unarchive actions become reversible in <=2 clicks.

### 3) Filter Clarity

- Why: Users lose context when many filters are active.
- Scope:
  - Show active filter chips in top bar (category, subcategory, tags, time, media).
  - Add one-click "Clear all filters".
- Effort: S
- Success metric:
  - Reduced filter reset friction, measured by fewer manual deselect actions.

### 4) Sync Feedback

- Why: Users need confidence that sync worked.
- Scope:
  - Show sync progress state and post-sync summary (new/updated/skipped).
  - Add last sync timestamp and recent sync history entry points.
- Effort: S-M
- Success metric:
  - Fewer "did sync work?" support moments.

### 5) Accessibility Baseline

- Why: Core interactions should not depend on mouse-only flows.
- Scope:
  - Keyboard-open cards and drawer actions.
  - Labels/aria for icon-only controls.
  - Focus-visible states and reduced-motion respect.
- Effort: M
- Success metric:
  - Full browse -> open -> edit -> archive flow usable by keyboard only.

## Next (2-6 weeks)

### 6) Multi-select + Bulk Actions

- Why: Manual one-by-one curation does not scale.
- Scope:
  - Multi-select on grid.
  - Bulk set category/subcategory, add tags, archive, run AI reclassify.
  - Sticky bulk action bar with undo toast for destructive actions.
- Effort: M-L
- Success metric:
  - Time to triage 100 bookmarks reduced by >=50%.

### 7) AI Transparency UI

- Why: Trust improves when users can see why AI suggested something.
- Scope:
  - Per-item "AI suggested" badge with confidence band.
  - Short explanation string (keywords or rationale).
  - Quick "accept all AI tags" and "reject suggestion" actions.
- Effort: M
- Success metric:
  - Higher acceptance rate of AI suggestions, fewer immediate reversals.

### 8) Keyboard-First Power Mode

- Why: Heavy users need speed.
- Scope:
  - `j/k` navigation, `enter` open, `e` edit tags/category, `a` archive, `?` shortcuts.
  - Optional command palette for fast actions.
- Effort: M
- Success metric:
  - Repeat users can process bookmarks without constant pointer movement.

### 9) Saved Views / Collections

- Why: Recurring workflows should be one click.
- Scope:
  - Save current filter state as named view.
  - Pin views in sidebar.
- Effort: M
- Success metric:
  - Frequent filter combinations are reused instead of rebuilt.

## Later (6+ weeks)

### 10) Reading Mode

- Why: Some sessions are curation, others are deep reading.
- Scope:
  - Distraction-free reader for selected bookmark/thread content.
- Effort: M

### 11) Cross-source UX

- Why: Booked value grows with unified saved content.
- Scope:
  - Source-aware cards and filters (X, Reddit, more later).
  - Keep category/tag/notes workflow consistent across sources.
- Effort: L

### 12) Scale UX for Large Libraries

- Why: Performance and scanability must hold at high volume.
- Scope:
  - Virtualized grid/list options.
  - Faster search and large-result affordances.
- Effort: M-L

## Suggested Implementation Order in Current Codebase

1. `client/src/hooks/useFilters.js`
2. `client/src/components/Sidebar.jsx`
3. `client/src/components/TopBar.jsx`
4. `client/src/App.jsx`
5. `client/src/components/BookmarkCard.jsx`
6. `client/src/components/BookmarkDetail.jsx`
7. `client/src/hooks/useBookmarks.js`

## Notes for Prioritization

- Highest immediate ROI: Inbox + Archive visibility + Filter clarity.
- Highest throughput impact: Bulk actions + Keyboard shortcuts.
- Highest trust impact: AI transparency + Sync feedback.


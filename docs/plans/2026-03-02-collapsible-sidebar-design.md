# Collapsible Sidebar Design

**Date:** 2026-03-02
**Status:** Approved

## Summary

Add an icon-rail collapsible sidebar to the Booked app. When collapsed, the sidebar shrinks to ~52px and shows only icons with hover tooltips. State persists to `localStorage`.

## Approach

Pure custom implementation — no new dependencies. Fully integrated with the existing CSS variable theme system and Tailwind semantic tokens.

## Behavior

| State | Width | Content |
|---|---|---|
| Expanded | 240px (`w-60`) | Logo + text, labeled nav items, tags, theme picker, sync button |
| Collapsed | 52px (`w-[52px]`) | Bookmark icon, icon-only nav, theme swatch, sync icon |

- Width transition: `transition-[width] duration-200 ease-in-out`
- Text fades via `opacity-0` on collapse (so content doesn't bleed outside sidebar)
- `overflow: visible` on `<aside>` so tooltips can escape the rail
- Tags section hidden when collapsed
- Toggle button: small circle floating on the right border, appears on sidebar hover, chevron rotates 180°

## Files Changed

- `App.jsx` — add `sidebarCollapsed` state + `localStorage` persistence
- `Layout.jsx` — accept `collapsed` + `onToggle` props, render toggle button on border
- `Sidebar.jsx` — full collapsible support: icons per category, tooltips, collapsed footer

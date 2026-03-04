# Booked Skill Usage (`/Booked`)

This guide is what `/Booked --help` should show in agent sessions.

## Core Commands

- `/Booked`  
  Incremental sync (same as `--sync`).

- `/Booked --sync`  
  Sync only what's new since last run.

- `/Booked --range=week`
- `/Booked --range=month`
- `/Booked --range=year`  
  Sync by saved-time window.

- `/Booked --count=100`  
  Sync last N bookmarks.

- `/Booked --all`  
  Full history sync.

## AI Sorting Commands

- `/Booked --ai-sort` or `/Booked --ai-sort=all`  
  Reclassify all local bookmarks with AI.

- `/Booked --ai-sort=uncategorized`  
  Reclassify only uncategorized bookmarks.

- `/Booked --ai-sort=category:Dev`  
  Reclassify only one category.

- Optional with AI sort:
  - `--limit=200`
  - `--include-archived`
  - `--overwrite-tags`

## Help Commands

- `/Booked --help`
- `/Booked --usage`
- `/Booked --commands`

All three return this guide and do not run sync/sort.

## First-Time Setup

1. Import X cookies into Playwright state:

```bash
node /Users/tyler/Development/Booked/server/import-cookies.js ~/Downloads/cookies.json
```

2. If import-cookies is not possible, fallback:

```bash
node /Users/tyler/Development/Booked/server/auth.js
```

## Repo Commands

- Start dev (server + client):

```bash
cd /Users/tyler/Development/Booked
npm run dev
```

- Start production-style server:

```bash
cd /Users/tyler/Development/Booked
npm run start
```

- Run server tests:

```bash
cd /Users/tyler/Development/Booked
npm run test --workspace=server
```

## Notes

- AI sorting requires `ANTHROPIC_API_KEY` in environment.
- Sync requires `data/playwright-session.json`.
- Existing user tags are preserved by default during AI sort unless `--overwrite-tags` is set.

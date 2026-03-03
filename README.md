# Booked

Local-first X (Twitter) bookmark manager with AI-assisted categorization.

Booked runs on your machine, scrapes bookmarks from `x.com/i/bookmarks` using your existing logged-in session, and gives you a fast UI for search, filtering, tagging, category/subcategory management, and notes.

## Features

- Local-first storage in JSON (`data/bookmarks.json`, `data/meta.json`)
- Incremental sync from X via Playwright + GraphQL response interception
- AI classification (category/subcategory/tags) via Anthropic Claude Haiku
- Category tree with subcategories and cascading rename/delete semantics
- Fast client-side filtering, sort, and fuzzy search (Fuse.js)
- Infinite scroll card grid and bookmark detail drawer
- Multiple visual themes with persisted selection

## Tech Stack

- Frontend: React 18, Vite, Tailwind CSS
- Backend: Express 4 (Node ESM)
- Scraping: Playwright
- AI: `@anthropic-ai/sdk`
- Tests: Vitest + Supertest (server)

## Prerequisites

- Node.js 18+ (Node 20 recommended)
- npm
- An X account already logged in on your machine
- Optional: Anthropic API key for AI auto-tagging

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Initialize local data files (required on fresh clones):

```bash
mkdir -p data
test -f data/bookmarks.json || echo "[]" > data/bookmarks.json
test -f data/meta.json || cat > data/meta.json <<'JSON'
{
  "lastSyncedAt": null,
  "categories": [
    { "name": "Design", "children": [] },
    { "name": "Dev", "children": [] },
    { "name": "Tools", "children": [] },
    { "name": "Threads", "children": [] },
    { "name": "Reads", "children": [] },
    { "name": "Uncategorized", "children": [] }
  ],
  "totalBookmarks": 0
}
JSON
```

4. Import your X cookies into Playwright session state (recommended auth path):

```bash
node server/import-cookies.js ~/Downloads/cookies.json
```

5. Start development mode (API + client):

```bash
npm run dev
```

6. Open:

- Client dev server: `http://localhost:5173`
- API server: `http://localhost:3333`

## Environment Variables

From `.env.example`:

- `ANTHROPIC_API_KEY` (optional): enables AI category/tag suggestions during sync
- `PORT` (optional): API port (default `3333`)

Without `ANTHROPIC_API_KEY`, sync still works and falls back to `Uncategorized` with empty tags.

## Run Modes

- Development: `npm run dev` (concurrent server + Vite client)
- Production-style:

```bash
npm run build
npm run start
```

Production serves the built client from `client/dist` via Express on port `3333`.

## Syncing Bookmarks

### In the app

Use the Sync button in the sidebar.

### Via API

```bash
curl -X POST http://localhost:3333/api/sync \
  -H "Content-Type: application/json" \
  -d '{"range":"sync"}'
```

Supported options:

- `range`: `sync` (default), `week`, `month`, `year`, `all`
- `count`: integer max count override

### Via Claude skill (optional workflow)

This repository is designed to pair with a local `/x-bookmarks` skill workflow.

## API Summary

### Bookmarks

- `GET /api/bookmarks?category=&tag=&archived=&sort=&limit=&offset=`
- `GET /api/bookmarks/:id`
- `PATCH /api/bookmarks/:id` (editable fields: `tags`, `category`, `subcategory`, `notes`, `archived`)
- `DELETE /api/bookmarks/:id`

### Meta

- `GET /api/meta`
- `PATCH /api/meta` (currently categories update path)
- `POST /api/meta/tags/rename`
- `POST /api/meta/tags/delete`

### Categories

- `GET /api/categories` (tree with counts)
- `POST /api/categories` (create category or subcategory)
- `PATCH /api/categories/:name` (rename, cascades bookmarks)
- `DELETE /api/categories/:name` (delete, cascades bookmarks)

### Sync

- `POST /api/sync` (scrape -> classify -> upsert)

## Data Model

Bookmark records include:

- Core tweet info: `id`, `url`, `text`, `author`, `postedAt`, `bookmarkedAt`
- Engagement metrics: `metrics.likes`, `metrics.retweets`, `metrics.replies`
- Organization: `category`, `subcategory`, `tags`, `aiSuggestedTags`, `notes`, `archived`
- Local saved-order fields: `savedAt`, `savedSeq`

Meta file includes:

- `lastSyncedAt`
- category tree (`categories`)
- `totalBookmarks`

## Testing

Run server tests:

```bash
npm run test --workspace=server
```

## Docs

- [Architecture & Repository Guide](docs/ARCHITECTURE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [X GraphQL API Notes](docs/X_API_NOTES.md)
- [Scaling Notes](docs/SCALING.md)
- [Improvements Roadmap](docs/IMPROVEMENTS.md)
- Session notes and design plans under [`docs/plans`](docs/plans)

## Security Notes

- `data/playwright-session.json` contains authenticated cookies; keep it private.
- `.env` and data files are local machine state and should not be committed.

## License

MIT. See [LICENSE](LICENSE).

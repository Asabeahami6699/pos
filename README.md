# POS Inventory — Monorepo

Multi-tenant POS & inventory system with Supabase realtime.

## Structure

```
pos-inventory/
├── apps/
│   ├── web/          # React + Vite frontend
│   └── api/          # Express API (privileged operations)
├── packages/
│   └── shared/       # Shared TypeScript types
└── supabase/         # Database, edge functions, realtime config
```

## Quick start

```bash
# Install all workspace dependencies
npm install

# Copy env and fill in Supabase credentials
cp .env.example apps/web/.env
cp .env.example apps/api/.env

# Run frontend only
npm run dev:web

# Run API only
npm run dev:api

# Run both
npm run dev:all
```

## Realtime + React Query

Live updates use **Supabase Realtime** (`postgres_changes`). React Query caches server state; realtime events invalidate the matching query keys so UI stays in sync without manual refetch wiring in every component.

## Database types

Shared types live in `packages/shared/src/database.types.ts`. Regenerate from your linked Supabase project:

```bash
npm run gen:types
```

## Migrations

SQL migrations are in `supabase/migrations/`. Apply to a linked project:

```bash
supabase db push
```

## Realtime

Live updates use **Supabase Realtime** (`postgres_changes`) on 14+ tables. The frontend subscribes directly via `@supabase/supabase-js` — no polling. The API handles privileged writes (company/staff creation); data sync remains realtime through Supabase.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:web` | Start Vite dev server (port 5173) |
| `npm run dev:api` | Start Express API (port 3001) |
| `npm run dev:all` | Run web + API concurrently |
| `npm run build` | Build shared → api → web |

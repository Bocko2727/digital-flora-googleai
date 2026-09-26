# Spec: Server-side pagination for GET /api/plants (T13)
What it does: the catalog loads one page of plants at a time from the server instead of the whole table, so it stays fast as the catalog grows.

Done when:
- `GET /api/plants?limit=24&cursor=<created_at,id>&q=&family=&confidence=&letter=` returns `{items, nextCursor, total}`.
- Without query params the endpoint keeps returning the full array exactly as today (backward compatible for the current UI and tests).
- Search (common/latin, case-insensitive), family, confidence prefix and the A–Z letter filter run in SQL, with results identical to today's client-side filters (an e2e parity test with the paginated fixture).
- Indexes:
  - `plants(created_at desc, id)` for keyset pagination;
  - optionally `pg_trgm` GIN on `lower(common_name)`/`lower(latin_name)` when the table exceeds ~2,000 rows.
- p95 of `/api/plants` stays under 300 ms at 5,000 rows (measured on a Supabase branch, never production).

Not included: infinite scroll UI redesign, full-text search ranking, server-side sorting beyond newest and A–Z.

Touches: `getSupabasePlants` (`src/db/plants.js`), `/api/plants` in `server.js`, `loadPlants`/`onFilterChange`/`renderCurrentPage` in `index.html`, and the pagination e2e tests.

Constraints:
- Today there are 98 rows and the full payload is small, so **this is not needed yet.**
- **Threshold to implement:** more than ~500 plants, or a `/api/plants` payload over ~500 KB, or p95 over 500 ms in Vercel logs — whichever comes first.
- Keyset (cursor) pagination rather than OFFSET, per Supabase Postgres best practices.

Needs schema change: yes, indexes only (a migration through flora-schema-change, tested on a Supabase Preview branch). No column changes.

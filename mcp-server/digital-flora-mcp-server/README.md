# Digital Flora MCP Server

A custom MCP server for the **Digital Flora** botanical catalog (Supabase-backed). It wraps the
`plants` table with workflow-shaped tools instead of raw CRUD, so an agent can browse the
catalog, log new finds, attach photos, and run the taxonomy-review workflow safely.

## Why a custom server, given the generic Supabase connector already exists?

The generic Supabase connector can run arbitrary SQL and manage the project at the infra level,
but it doesn't know Digital Flora's own rules:

- `common_name` / `latin_name` must be non-empty (DB check constraint)
- `photos` is a jsonb array that should be appended to, not overwritten
- `taxonomy_status` must only become `"editor-confirmed"` together with a real `gbif_taxonomy`
  value, never on its own — a GBIF match should never be auto-published as verified fact
- `taxonomy_status` values are one of a fixed set (`manual-unverified`, `source-suggested`,
  `editor-confirmed`, `needs-review`)

This server encodes those rules as tools, so an agent (or you) can't accidentally violate them.

## Tools

| Tool | What it does | Read/Write |
|---|---|---|
| `flora_list_plants` | Search/filter/paginate the catalog | read |
| `flora_get_plant` | Fetch one full record by id | read |
| `flora_add_plant` | Create a new plant record | write |
| `flora_update_plant` | Edit text fields on an existing record | write |
| `flora_add_photo` | Append a photo (by URL) to a plant | write |
| `flora_list_plants_needing_review` | List everything not yet editor-confirmed | read |
| `flora_confirm_taxonomy` | Record a confirmed GBIF match, mark `editor-confirmed` | write |
| `flora_get_catalog_stats` | Counts by taxonomy status / confidence / missing photos | read |

All tools support `response_format: "markdown" | "json"` and return actionable error messages
(e.g. "Plant `<id>` not found").

## Setup

```bash
npm install
cp .env.example .env   # fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
npm run build
```

Find the two Supabase values in your project dashboard: **Settings → API** →
Project URL and the `service_role` secret key. The service role key bypasses Row Level
Security — that's intentional here (this is a personal, single-user catalog and RLS is
still being built out per your notes), but it means this server must only run somewhere
you control, never in a browser.

## Option A — develop and test in a GitHub Codespace

Since your work machine can't install software, do the "local" dev/test loop in a Codespace
(same terminal + Copilot Chat workflow you already used on Digital Flora):

1. Push this folder into the Digital Flora repo (or its own repo), open a Codespace on it.
   Codespaces images ship Node already — `node -v` should just work.
2. In the Codespace terminal:
   ```bash
   npm install
   cp .env.example .env
   ```
3. Fill `.env` with `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — or better, don't put secrets
   in a file at all: add them as **Codespaces secrets** (GitHub repo/org → Settings →
   Codespaces → "Repository secrets" or your personal Codespaces secrets), scoped to this repo.
   They then appear as env vars automatically, `.env` stays empty/untracked.
4. `npm run build`, then test every tool by hand before wiring anything to Claude:
   ```bash
   npx @modelcontextprotocol/inspector node dist/index.js
   ```
   Codespaces will offer to forward the Inspector's port to your browser — click through it.
   This gives you a UI to call `flora_list_plants`, `flora_add_plant`, etc. directly.

A Codespace is a great dev loop, but it sleeps/stops and its URL isn't stable — it is **not**
where the server should live long-term for Claude to call it. That's Option B.

## Option B — where the server actually runs (Streamable HTTP)

```bash
TRANSPORT=http PORT=3000 MCP_SERVER_TOKEN=<random secret> npm start
```

This exposes `POST /mcp` (the MCP endpoint, auth-protected) and `GET /healthz` (open, for the
host's health checks). Deploy it anywhere that keeps a Node process running continuously —
**Railway** or **Render** are the least-friction options (connect the GitHub repo, they detect
`npm run build` / `npm start`, no code changes needed). It is **not** wired for Vercel's
serverless functions as-is (those need a request handler, not `app.listen`) — say so if you'd
rather have it on Vercel and I'll adapt `src/index.ts` into a Vercel function instead.

Steps on Railway (Render is nearly identical):
1. New Project → Deploy from GitHub repo → pick this repo.
2. In the service's **Variables** tab, set: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `TRANSPORT=http`, `MCP_SERVER_TOKEN` (generate with `openssl rand -hex 32` — do this once in
   the Codespace terminal and reuse the same value in Claude's connector config).
3. Deploy. Railway gives you a public URL like `https://digital-flora-mcp-production.up.railway.app`.
   Your MCP endpoint is `https://.../mcp`.
4. Hit `https://.../healthz` in a browser to confirm it's alive (should return `{"status":"ok"}`
   with no auth needed).

**Why `MCP_SERVER_TOKEN` matters:** this server holds your Supabase `service_role` key, which
bypasses Row Level Security entirely. Without the token check, anyone who found the URL would
have unrestricted read/write on your catalog. The server refuses to start in HTTP mode without
this token set.

## Activating it in Claude (custom connector)

There's no API for this — it's a one-time step in Claude's own settings:

1. In Claude (web/desktop), go to **Settings → Connectors → Add custom connector**.
2. Paste the MCP URL (`https://.../mcp`) and the auth header the server expects:
   `Authorization: Bearer <the same MCP_SERVER_TOKEN>`.
3. Save, then enable it for whichever chat/session you want it available in.

Once enabled, its 8 tools show up alongside your other connectors — you can ask me things like
"list plants that still need taxonomy review" and I'll call `flora_list_plants_needing_review`
directly.

## Authenticating everything this setup touches

- **Supabase** (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`): Supabase dashboard → your
  `digital-flora` project → **Settings → API**. Copy the Project URL and the `service_role`
  secret (not the `anon` key — that one respects RLS and would block writes until RLS policies
  exist). Treat it like a root password: only in env vars / platform secrets, never in git,
  never in a browser-facing config.
- **GitHub / Codespaces**: you're already authenticated via your GitHub login; Codespaces
  secrets ride on that, no separate setup.
- **Railway or Render**: sign in with GitHub (OAuth, one click), which is also how they get
  permission to read your repo for deploys — no separate token to manage.
- **`MCP_SERVER_TOKEN`**: not tied to any provider — it's a secret *you* generate once
  (`openssl rand -hex 32`) and paste into two places: the hosting platform's env vars, and
  Claude's custom connector config. Rotate it (regenerate + update both places) if you ever
  suspect the URL leaked.
- **Claude custom connector**: authenticated by that same bearer token, set once when you add
  the connector in Settings.

## Project structure

```
src/
├── index.ts          # server entry point (stdio + HTTP transports)
├── types.ts           # shared TypeScript types
├── constants.ts        # shared constants (page sizes, enums)
├── schemas/common.ts    # shared Zod schema fragments
├── services/
│   ├── supabase.ts    # Supabase client + column list + error formatting
│   └── format.ts       # markdown/JSON response helpers, pagination
└── tools/              # one file per tool
```

## Known follow-ups (not built yet)

- No `flora_delete_plant` tool — deletion was left out deliberately; add it explicitly if you
  want agents able to delete records, with a confirmation step.
- Photo upload itself (bytes → Supabase Storage) is out of scope — `flora_add_photo` only
  records a URL that's already uploaded. If you want the server to handle the upload too, that's
  a reasonable next tool to add.
- `flora_list_plants` search is a simple `ilike` substring match, not full-text search.

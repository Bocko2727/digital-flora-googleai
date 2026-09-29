# Next session prompt — Digital Flora (written 2026-09-27, after the overnight audit)

Paste into a new Claude Code session on Bocko2727/digital-flora-googleai. Reply in Bulgarian. CLAUDE.md applies in full.

## Context (verified 2026-09-26/27)
- **Vercel's Production Branch is `main`** (since 2026-09-26 ~06:10 UTC): every merge into `main` is a production deploy. `refactor/catalog-foundation` is no longer the production branch.
- **Production was down** at the end of the audit: the production domains serve `dpl_EGJzU13C9Vezo1k8vyN5UCfvmGrf` (`main@6a6d744`), which returns 500 on every request (`Cannot find package 'express'`: the project skips the install step). PR #37 (`claude/automated-audit-fixes-fzir72`) fixes it; its preview builds with `npm ci` and `/health` returns 200. First check whether #37 is merged and production is healthy.
- Production `SUPABASE_DB_URL` points at the IPv6-only direct host `db.sxuxtsbyqjaodyuqebux.supabase.co` (`getaddrinfo ENOTFOUND` on Vercel). After #37, reads, role lookups and writes fall back to the Data API; the real fix is the owner switching the value to the Transaction pooler URI (port 6543).
- The Supabase–Vercel integration's env var names are prefixed with the publishable key (`sb_publishable_…_SUPABASE_URL`); their Preview values are invalid (`ENOTFOUND base`). Never hardcode those names (the `v0/fix-preview-env-loading` branch does; do not merge it).
- Full findings and owner actions: `docs/review/overnight-audit-2026-09-26.md`.

## Remaining tasks (flora-task-handoff format)

## Task B: Screenshot baselines
Assigned to: Claude
In scope: run `screenshot-baseline.yml` (workflow_dispatch) on `main`, download its artifact, and commit the 4 PNGs to `tests/e2e/screenshots.spec.js-snapshots/` in a draft PR.
Out of scope: changing the workflow.
Depends on / blocks: nothing; needs a way to download the Actions artifact.
Done when: `screenshots.spec.js` passes against the committed baselines.

## Task E: GBIF autocomplete (spec: `docs/specs/gbif-autocomplete.md`)
Assigned to: Claude
In scope: the `GET /api/taxonomy/suggest` server proxy with a 24 h cache and a rate limit; the editor UI on `#e_lname`; mocked unit and e2e tests; picking a suggestion sets `taxonomy_status = source-suggested`.
Starting point: `src/integrations/gbif.js` and `tests/gbif-search.test.js` on the stale branch `claude/mcp-integration-codespaces-u1e36g` (open PR #5). Review them, don't trust them.
Out of scope: Pl@ntNet, iNaturalist, re-classifying existing records.
Depends on / blocks: owner OK for the new external API (§4.10; free, no key).
Done when: the mocked e2e passes and the feature is verified on a Vercel preview.

## Task F2: Remove the GitHub raw image fallback (owner yes)
Assigned to: Claude
In scope: `server.js` `fetchAllowedGithubImage` and its helpers (used by `/api/qa` and the missing-image route). It fetches from a different repo, `Bocko2727/digitalflora`. Images now live in Supabase Storage, and a missing local file already gets the "Снимката липсва" SVG.
Depends on / blocks: owner approval; first confirm in the Vercel runtime logs that no production record still depends on it.
Done when: tests pass and nothing references the removed code.

## Task G: Stale remote branches (owner yes, §4.9)
Assigned to: Claude
In scope: list the candidates and delete them only after an explicit per-list yes: branches of merged PRs (`chore/run-skill`, `claude/post-26-docs-sync`, `claude/vercel-records-loading-ynzc62`), `v0/fix-preview-env-loading`, and `claude/mcp-integration-codespaces-u1e36g` (only after Task E has taken what it needs).
Out of scope: `main`, `refactor/catalog-foundation` (legacy production branch; the owner decides its fate).
Done when: `git ls-remote --heads` shows only the live branches.

## Standing constraints
- `File_017.png` is still an orphan in Storage with an unresolved identification. Do not touch it without explicit approval (CLAUDE.md §2).
- Migration drift `20260924070000` is unchanged; the repair is the owner's call.

## Working mode
- Git: one task = one branch = one draft PR. Never merge, never force-push. A merge into `main` deploys production.
- Playwright: see `SKILL.md` → Tests (temp config with `executablePath: '/opt/pw-browsers/chromium'` and `webServer.cwd`; never `playwright install`). `tests/e2e/auth-role-state.spec.js` shows how to test signed-in states without touching Supabase.
- Unit tests that load `src/` must import `tests/support/isolated-supabase-env.js` first.

## End of session
1. Final report per CLAUDE.md §11, plus a "waiting for approval" list.
2. Rewrite this file for the next session (draft PR).

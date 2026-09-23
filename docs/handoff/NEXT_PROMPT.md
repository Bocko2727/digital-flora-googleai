# Next session prompt — Digital Flora (written 2026-09-23, day session)

Paste into a new Claude Code session on Bocko2727/digital-flora-googleai. Reply in Bulgarian. CLAUDE.md applies in full.

## Context (verified 2026-09-23)
- PRs #12–#22 are all in `main` (head `ed59388`). No open PRs except this session's lint/docs draft PR (`claude/repo-check-jr94ia`).
- Production (`refactor/catalog-foundation`) is `da85adc`, whose tree is identical to `main`. The Vercel production deployment is READY, with 0 runtime errors in the last 24 h.
- The owner-approved data work (old Task D) is done and recorded in `docs/review/data-changes-2026-09-23.md`, with rollback steps.
- Checks on `main`: lint (35 files after this session's fix), 21/21 unit tests, secret scan 0, `npm audit --omit=dev` 0. e2e passes 46/50; the 4 failures are `screenshots.spec.js`, which has no baselines yet (Task B).
- The Supabase MCP server failed to connect in this session (`ERR_PROXY_TUNNEL`), so no DB read-back was possible.

## Remaining tasks (flora-task-handoff format)

## Task B: Screenshot baselines
Assigned to: Claude
In scope: run `screenshot-baseline.yml` (workflow_dispatch) on `main`, download its artifact, and commit the 4 PNGs to `tests/e2e/screenshots.spec.js-snapshots/` in a draft PR.
Out of scope: changing the workflow.
Depends on / blocks: nothing; needs a way to download the Actions artifact.
Done when: `screenshots.spec.js` passes against the committed baselines.

## Task E: GBIF autocomplete (spec: `docs/specs/gbif-autocomplete.md`)
Assigned to: Claude
In scope:
- the `GET /api/taxonomy/suggest` server proxy with a 24 h cache and a rate limit;
- the editor UI on `#e_lname`;
- mocked unit and e2e tests;
- picking a suggestion sets `taxonomy_status = source-suggested`.

Starting point: `src/integrations/gbif.js` and `tests/gbif-search.test.js` on the stale branch `claude/mcp-integration-codespaces-u1e36g`. Review them, don't trust them.
Out of scope: Pl@ntNet, iNaturalist, re-classifying existing records.
Depends on / blocks: owner OK for the new external API (§4.10; free, no key).
Done when: the mocked e2e passes and the feature is verified on a Vercel preview.

## Task F2: Remove the GitHub raw image fallback (owner yes)
Assigned to: Claude
In scope: `server.js` `fetchAllowedGithubImage` and its helpers, used by `/api/qa` (~l.251) and the image route (~l.376). It fetches from a different repo, `Bocko2727/digitalflora`, on `raw.githubusercontent.com`. Images now live in Supabase Storage, and a missing local file already gets the "Снимката липсва" SVG.
Out of scope: Storage and data.
Depends on / blocks: owner approval. First confirm that no production record still depends on it (check the Vercel runtime logs for such fetches).
Done when: tests pass and nothing references the removed code.

## Task G: Stale remote branches (owner yes, §4.9)
Assigned to: Claude
In scope: list the candidates below and delete them only after an explicit per-list yes.
- merged: every `claude/*` branch of PRs #12–#22;
- obsolete: `fix/multer-2.3.0` (multer is no longer a dependency), `add-claude-github-actions-1789988548672` (superseded by `claude.yml` on main), `claude/mcp-integration-codespaces-u1e36g` (only after Task E has taken what it needs).
Out of scope: `main`, `refactor/catalog-foundation`.
Done when: `git ls-remote --heads` shows only the live branches.

## Standing constraint
- `File_017.png` is still an orphan in Storage with an unresolved identification. Do not touch it without explicit approval (CLAUDE.md §2).

## Working mode
- Git: one task = one branch = one draft PR. Never merge, never force-push.
- Playwright: see `SKILL.md` → Tests (temp config with `executablePath: '/opt/pw-browsers/chromium'` and `webServer.cwd`; never `playwright install`).
- Deploy only with the owner's explicit yes: sync `refactor/catalog-foundation` from `main` with a merge commit whose tree equals `main`.

## End of session
1. Final report per CLAUDE.md §8, plus a "waiting for approval" list.
2. Rewrite this file for the next session (draft PR).

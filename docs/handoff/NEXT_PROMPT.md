# Next session prompt — Digital Flora (written 2026-09-23 ~23:10 UTC)

Paste into a new Claude Code session on Bocko2727/digital-flora-googleai. Reply in Bulgarian. CLAUDE.md applies in full.

## Context (done in the 2026-09-23 night session)
- PR #12 is merged in main (`14d31f3`). Production (`refactor/catalog-foundation`) still runs the OLD code. The branches have diverged, so deploy with a merge commit whose tree equals main (commands in `docs/review/nightly-report-2026-09-23.md`, T2).
- Draft PRs (all CI green at creation):

| PR | What it does |
|---|---|
| #13 | AI-text label; review list of 89 AI botanical claims |
| #14 | SW first-load reload fix (the root cause of most e2e flakes) |
| #15 | e2e tests for PR #12 |
| #16 | lint for all JS; validator test |
| #17 | `taxonomy_status` wired, no migration |
| #18 | gemini-review manual-only |
| #19 | nightly report and specs (T9 image pipeline, T10 GBIF, T13 pagination), plus this prompt |
| #20 | upload spec race fix |
| #21 | CSP without 'unsafe-inline' |

- #21 conflicts with #13, #14 and #17 because it moved the script out of `index.html` into `app.js`.

## Remaining tasks (flora-task-handoff format)

## Task A: Rebase CSP PR #21 onto main after #13/#14/#17 merge
Assigned to: Claude
In scope:
- merge main into `claude/csp-no-unsafe-inline`;
- port the #13 AI mark, the #14 SW guard and the #17 taxonomy label and `#e_tax` into `app.js` / `data-*` attributes;
- re-run the CSP console check and the e2e suite.
Out of scope: new features.
Depends on / blocks: the owner merging #13, #14 and #17.
Done when: #21 is green, mergeable, with 0 CSP console errors.

## Task B: Screenshot baselines
Assigned to: Claude
In scope: run `screenshot-baseline.yml` (workflow_dispatch) on main after the UI PRs merge, and commit the baselines in a draft PR.
Out of scope: changing the workflow.
Depends on / blocks: A.
Done when: `screenshots.spec.js` passes in CI.

## Task C: Deploy (ONLY with the owner's explicit yes)
Assigned to: Claude
In scope: the T2 commands, the live checks, and a rollback if anything fails.
Out of scope: Vercel settings.
Depends on / blocks: merges; owner approval.
Done when: production is READY and the live checks pass.

## Task D: Owner-approved data work (each needs its own yes)
Assigned to: Claude
In scope:
- `taxonomy_status` backfill (SQL in #17);
- the group-A text rewrite (#13 list);
- IMG_5512 needs-review record.
Out of scope: anything not individually approved.
Depends on / blocks: owner.
Done when: each item is verified by SELECT, with its rollback kept.

## Task E: GBIF autocomplete implementation (spec in #19)
Assigned to: Claude
In scope: a server proxy with cache, the editor UI, mock tests, and `taxonomy_status = source-suggested`.
Out of scope: Pl@ntNet, iNaturalist.
Depends on / blocks: #17 merged; owner OK for a new external API (free, no key).
Done when: e2e with a mocked GBIF passes and it is verified on a Vercel preview.

## Task F: Legacy cleanup (owner yes)
Assigned to: Claude
In scope:
- remove the Cloud SQL code, the `.ts` duplicates and the drizzle deps;
- remove the `/api/users/sync` and `/api/drive/log` endpoints;
- remove or redirect the GitHub image fallback.
Out of scope: data.
Depends on / blocks: owner approval.
Done when: tests pass and nothing references the removed code.

## Working mode
- Agents: Explore for inventory; Plan for design; general-purpose with worktree isolation for independent code tasks (max 3). Run e2e from a path without dot-directories, because the server refuses to serve `/` from any path containing one (`dotfiles:'deny'`).
- Skills: flora-pre-deploy, flora-qa-check, flora-feature-spec, flora-schema-change, supabase-postgres-best-practices, code-review (high), security-review.
- Git: one task = one branch = one draft PR; subscribe to each PR and drive it to green. Never merge, never force-push.
- Playwright: use a temp config with `launchOptions.executablePath: '/opt/pw-browsers/chromium'`; never run `playwright install`.

## End of session
1. Final report per CLAUDE.md §8, plus a "waiting for approval" list.
2. Write the next prompt in this same format to `docs/handoff/NEXT_PROMPT.md` (draft PR).
3. Schedule a continuation (send_later, +2h, max one) ONLY if work remains that does not need the owner.

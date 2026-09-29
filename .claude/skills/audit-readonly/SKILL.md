---
name: audit-readonly
description: Read-only session-start baseline for Digital Flora (CLAUDE.md §12) — git state, open PRs, CI runs, Supabase migration drift and advisors, Vercel production deployment. Use at the start of a session or before planning work; never changes anything.
---

# Read-only audit — Digital Flora

Everything here is read-only. If a connector is missing or fails, write
`[BLOCKED: <reason>]` for that row and continue — do not guess the value.
Never call a write-capable tool from this skill.

## 1. Local git

```bash
git branch --show-current
git status --short
git log --oneline -8
git fetch origin --prune        # read-only for the working tree
git log --oneline -1 origin/main
git log --oneline -1 origin/refactor/catalog-foundation
```

Flag: detached HEAD, active merge/rebase, uncommitted changes, being on `main`.

## 2. GitHub (`mcp__github__*`, or the claude.ai `mcp__Github__*` connector)

- `list_pull_requests` with `state: open`, `perPage: 30` (fetch the next `page` while
  30 come back), `fields: [number, title, draft, head, base, created_at, updated_at]` —
  every open PR; flag stale ones (`updated_at`), PRs whose `base` is not `main`,
  duplicates, and PRs that touch the same files as the planned task.
- `list_pull_requests` with `state: closed`, `perPage: 10`,
  `fields: [number, title, merged, head, base, merged_at]` — recent merges; flag open
  PRs whose head is already merged.
- `actions_list` → `list_workflow_runs` with `resource_id: quality.yml`, `perPage: 1`
  and `workflow_runs_filter.branch` set to `main`, then `refactor/catalog-foundation`,
  then each open PR's head — the last `Quality` run on each.
- `pull_request_read` `get_files` returns full patches (100k+ characters on a large
  PR) — read only the file names.
- `list_branches` — note whether `main` is `protected` (repo setting; only the owner can change it).
- The claude.ai `mcp__Github__*` connector has no `actions_*` or `get_job_logs`. Where it
  is the only GitHub server, read PR CI with `pull_request_read` `get_check_runs` and the
  `main` run with `gh run list --workflow quality.yml --branch main --limit 1` if `gh`
  exists; otherwise `[BLOCKED: no Actions tools]`.

## 3. Supabase (project `sxuxtsbyqjaodyuqebux`)

Use `mcp__supabase__*` (project `.mcp.json`, read-only) or the claude.ai
`mcp__Supabase__*` connector, whichever connects. In Claude Code cloud sessions
the `.mcp.json` server does not connect (the network policy denies
`mcp.supabase.com` and the container cannot complete OAuth) — use
`mcp__Supabase__*` there.

- `list_migrations` — compare with `ls supabase/migrations/`. A remote version
  missing locally is **drift**: report it; do not apply or recreate anything.
- `get_advisors` (`security`, then `performance`) — list each lint with its remediation URL.
- `list_edge_functions` — expected: none.
- Never call `execute_sql`, `apply_migration`, branch or project tools here.

## 4. Vercel (team `borislaviliev2727-7527s-projects`, project `digital-flora-googleai`)

- `list_deployments` with `target: production`, `limit: 3` — confirm the latest
  READY production deployment and its `githubCommitRef` / `githubCommitSha`.
- Compare that SHA's tree with `origin/main` (`git diff --stat <sha> origin/main`).
- Never read env vars, never create/promote/rollback deployments.

## 5. Output

A short Bulgarian baseline: branch, dirty state, open PRs and overlaps, CI state,
migration drift, advisors, production SHA vs `main`, known blockers, and the next
safe step.

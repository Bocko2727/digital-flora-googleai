---
name: audit-readonly
description: Read-only session-start baseline for Digital Flora (CLAUDE.md §9) — git state, open PRs, CI runs, Supabase migration drift and advisors, Vercel production deployment. Use at the start of a session or before planning work; never changes anything.
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

## 2. GitHub (`mcp__github__*`)

- `list_pull_requests` with `state: all` — flag open PRs whose head is already
  merged, duplicates, and PRs that touch the same files as the planned task.
- `actions_list` → `list_workflow_runs` — last `Quality` run on `main`, on open PRs
  and on `refactor/catalog-foundation`.
- `list_branches` — note whether `main` is `protected` (repo setting; only the owner can change it).

## 3. Supabase (project `sxuxtsbyqjaodyuqebux`)

Use `mcp__supabase__*` (project `.mcp.json`, read-only) or the claude.ai
`mcp__Supabase__*` connector, whichever connects.

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

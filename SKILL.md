---
name: digital-flora-dev
description: Quick reference for local dev, testing and QA commands on Digital Flora. Use when running tests, validating plant data, scanning for secrets, or preparing a commit/push — not a general engineering guide.
license: MIT
---

# Digital Flora — dev quick reference

Policy, git discipline and hard safety boundaries live in `CLAUDE.md`
(authoritative) and `AGENTS.md` (stack/conventions) — read those first, they
are not repeated here.

## Local dev

- `npm ci` — install exact locked dependencies (needed once per fresh checkout/container).
- `npm run dev` / `npm start` — runs `server.js` (Express) on `PORT` (default 3000).

## Tests

- `npm test` — unit tests (`node --test tests/*.test.js`).
- `npm run test:e2e` — Playwright e2e (`tests/e2e/`). Backend is network-mocked
  via `tests/e2e/helpers.js::mockCatalogApi`, except `write-protection.spec.js`,
  which deliberately hits the real running server to prove the 401 auth boundary.
- `npm run lint` — `node --check server.js` (syntax check only; no ESLint/Prettier
  configured — don't add one without explicit approval).

## Botanical / catalog data QA

- `node scripts/qa/validate-plant-data.js` — canonical-data validator (read-only).
- `node --test tests/plant-data-validation.test.js` — validator smoke test.
- `node scripts/qa/scan-secrets.js` — scans tracked text files for secrets.

## Before every commit/push to `main`

`main` is the working trunk (see CLAUDE.md §2) and has no automatic CI gate on
push — `.github/workflows/quality.yml` only runs on PR or push to
`refactor/catalog-foundation`. Compensate manually:

1. Run the targeted unit/e2e test for what changed.
2. `node scripts/qa/scan-secrets.js`.
3. `git diff --check` + `git status --short` — confirm only the intended files changed.

## Triggering a real deploy

Vercel's Production Branch is currently `refactor/catalog-foundation`, not
`main` (until the project is mature enough to switch it — see CLAUDE.md §2).
To publish: sync `refactor/catalog-foundation` from `main` (fast-forward or
merge), then push that branch — this also re-runs `quality.yml` CI.

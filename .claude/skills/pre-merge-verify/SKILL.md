---
name: pre-merge-verify
description: Run the Digital Flora local quality gate (the same checks as .github/workflows/quality.yml plus diff hygiene) before a commit, push or Draft PR, and report each check as PASSED / FAILED / NOT RUN / NOT APPLICABLE. Use before any commit or push on this repo.
---

# Pre-merge verify — Digital Flora

Read-only except for `npm ci` (which only rebuilds `node_modules/` from the lockfile).
Never "fix" a failing check by weakening a test, assertion or scanner.

## 1. Diff hygiene

```bash
git status --short
git diff --stat
git diff --check
git diff --cached --check
```

- Only the files the task promised are changed; nothing under `images/`,
  `data/`, `supabase/migrations/` unless the task was about exactly that.
- No `.env*` (except `.env.example`), keys, certificates or credential files staged.
- No `package.json` / `package-lock.json` change unless a dependency change was explicitly approved.

## 2. Quality gate (mirror of `quality.yml`)

Run in this order; stop and report on the first real failure.

```bash
npm ci                                    # only if node_modules is missing or stale
npm run lint                              # scripts/qa/check-syntax.js (node --check on tracked JS)
npm test                                  # node --test tests/*.test.js
node scripts/qa/validate-plant-data.js    # read-only; 0 local records is expected (catalog lives in Supabase)
node --test tests/plant-data-validation.test.js
node scripts/qa/scan-secrets.js
```

`npm run build` is a no-op echo — report it as NOT APPLICABLE unless `package.json` changes that.

## 3. E2E (optional, local only)

`npm run test:e2e` needs Chromium. In Claude Code cloud containers use a temp
Playwright config outside the repo with
`launchOptions.executablePath: '/opt/pw-browsers/chromium'`; never run
`playwright install`. `screenshots.spec.js` fails until CI baselines are committed.
If the browser is not available, report E2E as NOT RUN with the reason.

## 4. Report

One line per check: `PASSED` / `FAILED` / `NOT RUN` / `NOT APPLICABLE`, with the
key output line (e.g. `# pass 28`, `Secret scan completed with 0 finding(s).`).
For a FAILED check, state whether this change caused it (compare with `main`).

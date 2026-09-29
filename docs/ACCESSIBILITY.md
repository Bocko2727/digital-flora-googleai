# Accessibility Audit — Digital Flora catalog (WCAG 2.2 AA)

## Audit overview

| | |
|---|---|
| Scope | `index.html` + `app.js`: catalog grid, sticky controls, plant detail dialog, editor sign-in dialog, create-plant dialog, edit form; light and dark theme; 1280px, 375px and 320px |
| Standard | WCAG 2.2 level AA (plus axe best-practice rules) |
| Baseline | audited on `main@6a6d744`, rebased and re-verified on `main@f182c92` |
| Method | 5 layers: axe-core 4 scan in Chromium (8 states), keyboard walk-through, accessible-name/role inspection, visual/contrast review, flow review |
| Date | 2026-09-27 |

## Executive summary

The catalog was not usable without a mouse: **plant cards could not be reached or opened with the keyboard**, dialogs did not take focus, and every search/filter control and every form field lacked a programmatic label. The dark theme failed text contrast in 21 places because one colour (`--green`) served both as text on dark surfaces and as the fill behind white text.

All findings below are fixed in this branch. After the fixes axe reports **0 violations in all 8 audited states** (was 4–6 rule failures per state, 1 serious in light and up to 39 nodes in dark), the new `tests/e2e/accessibility.spec.js` guards the fixes, and the full e2e suite passes (58/58 on top of `main@f182c92`).

## Score summary

| Severity | Found | Fixed |
|---|---|---|
| Critical | 3 | 3 |
| High | 5 | 5 |
| Moderate | 5 | 5 |
| Low | 3 | 3 |

| axe (wcag2a/aa, 21, 22aa, best-practice) | Before | After |
|---|---|---|
| Light catalog | 4 rules (1 serious contrast, 1 critical select-name) | 0 |
| Dark catalog | 4 rules, 32 contrast nodes | 0 |
| Plant dialog (light/dark) | 4 rules / 39 contrast nodes | 0 |
| Auth dialog | + 2 unlabelled inputs | 0 |
| Create dialog | + 10 unlabelled fields | 0 |

## Findings

### 1. Plant cards not keyboard operable — Critical · 2.1.1 (A), 4.1.2 (A)
Cards were `<div data-action="open-plant">` with a click handler only: 0 of 12 cards were focusable, so keyboard and switch users could not open any record.
**Fix:** the card title is now a real `<button class="plant-card-open">` inside the `<h3>`; the card keeps its click area and draws the focus ring around the whole card (`.plant-card:has(.plant-card-open:focus-visible)`).

### 2. Form fields and filters without labels — Critical · 1.3.1 (A), 4.1.2 (A)
4 selects and the search box (placeholder only), the 2 sign-in fields, 10 create-plant fields and 12 edit-form fields had visible text but no `for`/`id` association.
**Fix:** visually hidden `<label>`s for the toolbar (`.sr-only`), `for=` on every form label, `type="search"`, `aria-required` on the two required names.

### 3. Dialogs without dialog semantics or focus management — Critical · 2.4.3 (A), 4.1.2 (A)
Opening a record left focus on `<body>`; Tab walked behind the overlay; Escape closed only the plant dialog; focus was lost on close.
**Fix:** `role="dialog"`, `aria-modal`, `aria-labelledby` on all three overlays; `openDialog`/`closeDialog` move focus in, make the page behind `inert`, keep Tab inside, close the top dialog on Escape and return focus to the opener.

### 4. Dark theme text contrast — High · 1.4.3 (AA)
21 nodes failed, e.g. Latin names 4.0:1, confirmed badge 3.66:1, header subtitle 3.56:1, view toggle 2.88:1, theme button 3.21:1.
**Fix:** split the colour's two jobs. `--green` (text/accent) is `#5fae78` in dark (5.5–7.3:1 on every dark surface); new `--green-fill` / `--green-fill-hover` (`#285c38` / `#1b4026` in both themes) carry white text at 7.8:1 / 11.6:1.

### 5. Google Drive button contrast — High · 1.4.3 (AA)
White on `#3b82f6` = 3.67:1 in both themes. **Fix:** `#2563eb` (5.17:1), hover `#1d4ed8` (6.7:1).

### 6. Focus indicator removed on inputs — High · 2.4.7 (AA)
`outline: none` on toolbar and form fields; the only cue was a 1px border colour change.
**Fix:** global `:focus-visible` ring, 3px `--focus-ring` (7.4:1 light / 6.1:1 dark), white on the green header; `outline: none` removed.

### 7. Sticky toolbar covers the screen on phones — High · 2.4.11 (AA), 1.4.10 (AA)
At 320px the sticky toolbar was ~480px tall — most of a phone screen stayed covered while scrolling, hiding focused cards.
**Fix:** ≤600px the toolbar is a 2-column grid and the А–Я row scrolls horizontally (≈225px, under 50% of a 640px screen — tested); on screens under 500px tall it stops being sticky; `scroll-padding-top` follows its height so focused cards are never hidden.

### 8. No skip link — High · 2.4.1 (A)
~45 Tab stops (header, toolbar, 30 letters) before the first plant. **Fix:** „Към каталога“ skip link to `<main id="main">`.

### 9. Status changes not announced — Moderate · 4.1.3 (AA)
Counter, upload progress, AI verification result and form errors changed silently.
**Fix:** `role="status"` on `#counterText`, `#uploadStatus`, `#qa-result`; `role="alert"` on `#authError`, `#createPlantError`.

### 10. Toggle and page state only visual — Moderate · 4.1.2 (A)
**Fix:** `aria-pressed` on the view toggle (kept in sync by `setGridView`), `aria-current="page"` and „Страница N“ names on page numbers, pagination is a `<nav aria-label="Страници">`.

### 11. Heading order and landmarks — Moderate · 1.3.1 (A)
h1 → h3 jump; toolbar outside any landmark. **Fix:** hidden `<h2>Растения</h2>` before the grid; toolbar is `role="search"`.

### 12. Symbol-only names and decorative noise — Moderate · 2.4.6 (AA), 1.1.1 (A)
Close „×“ and back-to-top „▲“ were read as symbols; emoji icons were read aloud before every label; the logo repeated the page title; card photos repeated the card title.
**Fix:** `aria-label` „Затвори“ / „Нагоре“, emoji wrapped in `aria-hidden` spans, logo and card images `alt=""`.

### 13. Corrupted text in the UI — Moderate · 3.1 (readability), 4.1.2
`app.js` on `main@6a6d744` contained U+FFFD replacement characters in place of the first letter of „Запази промените“ (save button) and „основание“ (sources line). Screen readers announced garbage and 4 e2e tests (`getByRole('button', { name: /Запази промените/ })`) failed.
**Fix:** landed on `main` in `143bcc7` (fix(ui): repair UTF-8 text) while this audit was open; `tests/source-encoding.test.js` now guards it.

### 14. Motion — Low · 2.3.3 (AAA)
**Fix:** `prefers-reduced-motion` disables transitions, hover lifts and smooth scrolling (CSS and the three JS `scrollIntoView`/`scrollTo` calls).

### 15. Latin names without language — Low · 3.1.2 (AA)
**Fix:** `lang="la"` on card and dialog Latin names.

### 16. Form fields white in dark theme — Low · 1.4.3 / consistency
`.form-group` fields had no colours. **Fix:** `--input-bg` / `--ink`.

## What passed

`lang="bg"`; one `h1`; target sizes ≥24×24px everywhere (2.5.8); reflow at 320px without horizontal scroll (1.4.10); sign-in uses `autocomplete` and no cognitive test (3.3.8); numbered pagination instead of infinite scroll; the confidence badge always carries a word, not colour alone (1.4.1).

## Remaining / out of scope

- `alert()`/`confirm()` are still used for save/delete errors and the delete confirmation. They are accessible but block the page; see `docs/design/UX_REVIEW.md` (interaction design).
- Screen reader testing was done by inspecting roles and names in the accessibility tree, not with VoiceOver/NVDA. Run a 20-minute NVDA or VoiceOver pass before release.
- Visual-regression baselines (`screenshots.spec.js`) will need regenerating: dark-theme colours, the focus ring and the mobile toolbar changed on purpose.

## Ongoing compliance

- `tests/e2e/accessibility.spec.js` runs with the existing Playwright suite (no new dependencies): keyboard path to a record, focus trap and return, labels, toggle state, 4.5:1 contrast of key text in both themes, mobile toolbar height.
- `AGENTS.md` now carries the accessibility rules block so Copilot/Claude generate accessible markup by default.
- Before merging UI changes: Tab through the change, check it in dark theme, and check it at 320px.

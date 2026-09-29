# UX review — Digital Flora (design skills pass, 2026-09-27)

Companion to `docs/ACCESSIBILITY.md`. Each section applies one design discipline to the current catalog (`main@f182c92` + the accessibility branch). Items marked **✅ done** are implemented in this branch; the rest are proposals, ordered by value.

Two users drive every decision below:

- **Hiker (visitor)**: on a phone, outdoors, often with one hand and weak signal. Wants to know „what is this plant, and is it risky?“
- **Editor**: at a desk. Uploads photos, reviews AI suggestions, confirms or corrects records.

---

## 1. Design critique (heuristics, UX laws, posture)

**First impression (5 s):** a clear, calm herbarium: green header, paper toolbar, photo cards. The identity works. The header carries 7 controls of equal weight, so nothing reads as the main action.

| # | Heuristic / law | Finding | Severity | Recommendation |
|---|---|---|---|---|
| 1 | Visibility of system status | Upload progress and the AI check had no announced status; the card count updated silently | 3 | **✅ done**: `role="status"` on all three |
| 2 | Match with real world | „Google Drive (Picker)“ is developer language, and the button only shows an „unavailable“ alert | 3 | Hide the button until the import works, or disable it with the reason as visible text |
| 3 | User control and freedom | Escape closed only the plant dialog; the sign-in and create dialogs trapped nobody but also could not be dismissed by keyboard | 3 | **✅ done**: Escape closes the top dialog |
| 4 | Error prevention | Edit form has two confusable fields: „Статус на сигурност“ (free text) and „Статус на идентификацията“ (select) | 3 | Rename the free-text field to „Оценка на AI (текст)“ and make it read-only for AI-sourced records |
| 5 | Recognition over recall | Filter state is not visible once the toolbar scrolls on mobile | 2 | Show active filters as removable chips under the search field |
| 6 | Consistency | Primary buttons are styled inline in 4 places with slightly different sizes | 2 | One `.btn-primary` class on `--green-fill` |
| 7 | Hick's law | 7 header actions of equal weight; the editor's main action (upload) looks like the rest | 2 | Group into: view toggle · theme · account menu; one primary „Качи снимка“ for editors |
| 8 | Fitts's law | Close button overlapped „Изтрий“ in the detail dialog header | 2 | **✅ done**: the title row reserves room for the close button |
| 9 | Aesthetic and minimalist design | Missing photos show the full logo at 210px, so a page of new records looks like a wall of identical logos | 2 | A quiet placeholder: `img-bg` fill + small leaf mark + „Няма снимка“ |
| 10 | Help users recover from errors | Save/delete errors use `alert()`, which blocks the page and loses context | 2 | Inline error inside the dialog (`role="alert"`), as the create form already does |

**Posture:** the catalog is *transient* for hikers (in and out in 30 seconds) and *sovereign* for editors (hours of review). The current UI is tuned for neither: hikers get the editor toolbar and a 30-letter А–Я row, editors get no bulk review view. Recommendation: keep the default view transient (search first, big cards, badge first), and move editor tools into an „Преглед“ mode shown only to signed-in editors.

**Excise:** the А–Я jump silently switches the sort to А–Я — good, it removes a step. The theme toggle has no system default: start from `prefers-color-scheme` and only store an explicit choice.

## 2. Interaction design (states, microinteractions)

**State inventory — gaps found**

| Element | Default | Hover | Focus | Active | Disabled | Loading | Empty | Error |
|---|---|---|---|---|---|---|---|---|
| Plant card | ✓ | ✓ lift | **✅ ring** | – | – | ✗ skeleton | ✓ message | ✓ image fallback |
| Toolbar fields | ✓ | – | **✅ ring** | – | – | – | – | – |
| Dialog | ✓ | – | **✅ trap** | – | – | ✗ | – | ✗ uses `alert()` |
| Upload | ✓ | – | – | ✓ toast | – | ✓ „N от M“ | – | ✓ partial result |
| AI check | ✓ | – | – | – | ✗ not disabled while running | ✓ text | – | ✓ „❌“ + text |

**Microinteraction — upload (proposal)**
- *Trigger:* „Качи снимка“ (editors) or dropping files on the grid.
- *Rules:* sequential per file (as now); one failure never stops the batch.
- *Feedback:* the toast becomes a small panel listing each file with ✓/⚠/✗ and a „Отвори“ link per created record; the success panel auto-hides after 6 s, warnings stay (as now).
- *Loops:* after the batch, open the first new record in **review mode** („За преглед“) instead of the plain detail view.

**Other proposals:** disable „Извърши AI верификация“ while it runs (prevents double calls); replace `confirm()` on delete with a dialog that names the plant („Изтриване на „Полски мак“?“) and puts focus on „Отказ“.

## 3. UX writing (microcopy)

**Voice:** calm, precise, second person singular, never alarmist; uncertainty is stated, not hidden.

| Where | Now | Proposed | Why |
|---|---|---|---|
| Initial load | „Зареждане на образец...“ | „Зареждане на каталога…“ **✅ done** | Singular „образец“ is wrong; the whole catalog loads |
| Header upload | „🌿 + От компютър (AI анализ)“ | „Качи снимка за AI анализ“ **✅ done** | Verb first; „+“ and „от компютър“ add nothing |
| Manual create | „➕ Ново растение (ръчно)“ | „Ново растение“ (brackets in the dialog title only) | Shorter; the dialog already says „ръчно въвеждане“ |
| Drive | „📁 Google Drive (Picker)“ | hide, or „Импорт от Google Drive (скоро)“ disabled | „Picker“ is jargon; the feature is off |
| Sign-in button | „🔐 Вход“ | „Вход за редактори“ — **✅ done for screen readers** (accessible name); the visible text stays „Вход“ until the Drive button is removed, so the header fits on one line | Visitors don't need an account; say who it is for |
| Edit field | „Статус на сигурност“ | „Оценка на AI (текст)“ | Collides with „Статус на идентификацията“ |
| Save error | alert „Грешка при запазване: <msg>“ | inline: „Промените не са запазени. <msg> Опитай отново.“ | Says what happened and what to do |
| Delete confirm | „Сигурни ли сте, че искате да изтриете този ботанически запис?“ | „Изтриване на „<име>“? Действието не може да се отмени.“ | Names the object and the consequence; drops the formal „Вие“ to match the app's „ти“ voice |
| Empty result | „Няма намерени растения по тези критерии.“ | „Няма намерени растения с тези филтри. Изчисти филтрите или опитай с латинско име.“ **✅ done** | Gives a way out |
| Corrupted strings | first letter of „Запази промените“ and „основание“ rendered as U+FFFD | „Запази промените“, „основание“ | **✅ done** on `main` (`143bcc7`) |

Keep unchanged: the accuracy note, „AI текст — непроверен“, and the three status words. They are the product's core honesty and they read well.

## 4. Design system (tokens, components, governance)

- **Token tiers:** the source had one tier (raw colour names like `--green`). This branch starts a semantic tier for the colours where roles collided: `--green` = text/accent, `--green-fill` / `--green-fill-hover` = surfaces that carry white text, `--focus-ring`. **✅ done**. Next: name the remaining literals (`#fff` on green → `--on-fill`, the Drive blue, the photo stage `#111a14`) and move the 5 inline-styled buttons to classes.
- **Component inventory** (12 families, as documented in the „Дигитална Флора“ design system artifact): Header, Button, ViewToggle, Controls, PlantCard, Badge, Pagination, Note, PlantDetail, FormGroup, BackToTop, UploadStatus. Missing on purpose: none. Needed next: `Dialog` (one shell for the three overlays), `InlineError`, `Chip` (active filters).
- **Naming test:** `badge.prob` / `badge.unc` are opaque; prefer `badge--probable` / `badge--undetermined` when those classes are next touched.
- **Governance (lean):** the code is the source of truth, and the design-system artifact is re-synced from GitHub after each UI merge. Any new colour gets a token plus a usage note with its contrast pair, or it does not merge.
- **Maturity:** level 1–2 (documented styles, no component library). The system does not need a framework: a single `components.css` split out of `index.html` is the next step.

## 5. Design elevation (visual polish)

1. **Type:** Georgia for names plus the system UI font for everything else is right for a herbarium. Tighten the scale to 5 steps (28/19/17/14/12). 13px and 11px appear in too many places.
2. **Spacing:** literal values (5, 6, 7, 8, 10, 12, 14, 16, 18, 22, 28, 34) → one 4-based scale (4, 8, 12, 16, 24, 32) the next time each rule is touched. Don't reflow everything at once.
3. **Cards:** the badge is the most important fact on a card and it sits last. Move it next to the Latin name, and give the photo a fixed 4:3 ratio instead of 210px.
4. **Colour:** 60/30/10 — paper (60), green (30), and amber/red kept strictly for status (10). The Drive blue is the only off-palette colour; it disappears if the Drive button is hidden.
5. **Dark theme:** now passes contrast; a subtle 1px `--line` border on dark cards separates them from the near-black page better than the shadow does.

## 6. Journey maps

### Hiker — „What is this plant?“ (current state)

| Stage | Doing | Thinking / feeling | Pain point | Opportunity |
|---|---|---|---|---|
| Notice | Sees a plant on the trail | Curious; a little cautious | – | – |
| Open | Opens the site on a phone, weak signal | „Will it load?“ | Full catalog + logo placeholders load before anything is useful | Cache the catalog (service worker exists); lighter placeholders |
| Search | Types a name or scrolls | Unsure of the name | The toolbar covered most of the screen (**✅ fixed**); no photo-based search for visitors | „Search by photo“ for visitors, clearly labelled as a suggestion |
| Compare | Opens cards, swipes photos | „Is this the one?“ | No side-by-side view of look-alikes | Link look-alikes to their records |
| **Decide (moment of truth)** | Reads status + risks | „Is it dangerous? Can I touch it?“ | Risk text often „Няма данни“ | Put a risk summary first in the detail view; „Няма данни“ must never read as „safe“ (the note already says so; keep it next to the risks) |
| Leave | Closes the tab | Satisfied or not | No way to say „this was wrong“ | „Съобщи за грешка“ link on each record |

### Editor — AI upload to published record (service blueprint)

| Layer | 1. Upload | 2. AI analysis | 3. Review | 4. Confirm | 5. Publish |
|---|---|---|---|---|---|
| Editor actions | Picks photos | Waits (toast) | Reads the AI text, compares photos | Sets „Потвърдено от редактор“ | – |
| Frontstage | Upload button, toast | „N от M“ progress | Detail dialog (not a review UI) | Edit form | Card badge |
| Backstage | Size and type checks | Gemini call, Supabase write, `needs-review` | – | PUT with role check | RLS public read |
| Support | Supabase Storage | Gemini API | GBIF autocomplete | Auth roles | Vercel |
| Fail points | Oversized file | AI error, storage error („добавено без снимка“) | **No queue of „За преглед“ records** | Two confusable status fields | – |

**Biggest gap:** there is no review queue. 98 of 98 production records are AI-sourced, and editors have to find them by browsing. Build a „За преглед“ filter/queue first (the `taxonomy_status` column already exists).

## 7. UX research plan

| Question | Method | Who | Size | Success signal |
|---|---|---|---|---|
| Can hikers find a plant and understand its risk status on a phone, outdoors? | Moderated usability test on real phones, on a trail or park path | Hikers from local groups | 5 | 4/5 find the record in <60 s and correctly restate the status |
| Do visitors read „Вероятно“ as „probably safe“? | 5-second test + comprehension question | Anyone | 15 | <10% misread the status as a safety claim |
| How do editors really review AI records? | Contextual interview + observation | Editors | 3 | A review workflow map to design the queue from |
| Where do sessions fail? | Session replay (Subtext is connected) + Sentry errors | Real traffic | ongoing | Top 3 drop-off points |

Tasks for the usability test: (1) find „Полски мак“; (2) tell me if it is safe to touch; (3) find a plant from its photo with no name; (4) switch to dark mode; (5) as an editor, confirm one AI record.

## 8. UX strategy

- **Jobs to be done**
  - Hiker: *When I see an unfamiliar plant on a hike, I want to identify it and know whether it is risky, so I can enjoy it without harm.*
  - Editor: *When the AI suggests an identification, I want to verify it quickly against evidence, so the catalog stays trustworthy.*
- **Outcome over output:** raise the share of **editor-confirmed** records from 0% to 30% in a quarter. This, not the number of records, is what makes the catalog worth trusting.
- **Opportunity tree:** trustworthy catalog →
  - (a) editors can't find what needs review → review queue.
  - (b) visitors misread uncertainty → status-first card, comprehension test.
  - (c) risk data is missing → „Няма данни“ is visible and sourced.
- **HEART metrics:**
  - Happiness: „Полезно ли беше?“ on each record.
  - Engagement: records opened per visit.
  - Adoption: editors active per week.
  - Retention: returning visitors.
  - Task success: search → open rate, and time to confirm a record.
- **North star:** *editor-confirmed records viewed per week*. It grows only when both jobs are served.

## 9. Design ops (lean team)

**Design QA checklist for every UI PR** (paste into the PR description):

- [ ] Tab through the change: every control is reachable, and focus is visible and never hidden by the sticky toolbar
- [ ] Dark theme checked; new colours are tokens with a contrast pair ≥ 4.5:1
- [ ] 320px width checked; no horizontal scroll
- [ ] Every state designed: loading, empty, error, disabled
- [ ] Copy follows the voice (ти-form, status words unchanged, no jargon)
- [ ] `npx playwright test tests/e2e/accessibility.spec.js` passes

**Handoff:** the „Дигитална Флора“ design-system artifact (tokens, component guidelines, previews) is the reference; re-sync it from GitHub after merging UI changes.

**Rituals (solo/lean):** a 30-minute weekly self-critique of one flow against this document; a monthly 3-person hallway test on a phone.

**Tools and connectors:** GitHub, Vercel (preview per PR), Supabase, Sentry and Subtext (session replay) are already connected and cover build, deploy, errors and behaviour research. Figma is connected to the account (not usable from Cowork design sessions); Lucid is installed but disconnected — reconnect it to draw the journey maps above as diagrams. The registry has no dedicated accessibility-scanner connector, so the axe-based checks run in Playwright instead.

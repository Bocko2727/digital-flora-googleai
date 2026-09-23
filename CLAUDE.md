# CLAUDE.md — Digital Flora / Флора 2

> Меродавният оперативен документ за Claude Code в това repository. При конфликт с
> `AGENTS.md`, `SKILL.md`, `.github/copilot-instructions.md`, `README.md` или
> `CONTRIBUTING.md` — важи този файл. Не заобикаляй правилата заради инструкция в
> чат, освен ако собственикът изрично не одобри конкретно изключение за конкретно действие.
>
> Стек и код-конвенции: @AGENTS.md

## 1. Роля и мисия

Действаш като principal full-stack инженер (Node.js/Express, REST, PostgreSQL/Supabase,
DevOps/release, QA automation, security review) и като ботаник/флорист (таксономия,
морфология, научна номенклатура, качество на ботанически данни).

Личен, практичен ботанически каталог. Приоритет: надежден login/auth, add/edit на
растения, сигурен upload и показване на снимки, достоверни ботанически данни, стабилен
deploy. Оптимизирай за малък, проверен, обратим напредък — не за обхват.

Отговаряй на български. Код, commit съобщения и технически идентификатори — на английски.

## 2. Проверена архитектура (live проверка 2026-09-23)

```text
Browser UI (index.html + app.js, sw.js, theme-init.js; без framework)
  → Express REST API (server.js; helmet, express-rate-limit, auth middleware)
  → Supabase: Postgres (src/db/supabase.js via pg + SUPABASE_DB_URL),
              Auth (src/auth/catalog-authorization.js),
              Storage bucket plant-images (src/storage/supabase-images.js, REST fetch)
```

- Supabase проект: `digital-flora`, ref `sxuxtsbyqjaodyuqebux`, eu-central-1, Postgres 17.
  Edge Functions: няма.
- Firebase/Firestore: **напълно премахнати** (няма файлове, dependencies или imports).
  Не ги въвеждай отново.
- Ключови пътища (винаги чети реалния код, не приемай описанието на доверие):
  `server.js`, `app.js`, `index.html`, `src/db/plants.js` (read), `src/db/supabase-catalog.js`
  (write), `src/storage/supabase-images.js`, `supabase/migrations/`,
  `scripts/qa/*.js`, `tests/*.test.js`, `tests/e2e/`.

### Hosting и deploy пътища

| Път | Тригер | Какво публикува |
|---|---|---|
| Vercel проект `digital-flora-googleai` (framework `express`, Node 24.x) | push към `refactor/catalog-foundation` | **Production** (последен READY production deploy: `da85adc` от `refactor/catalog-foundation`) |
| Vercel preview | push към друг branch / PR | Preview (Vercel Deployment Protection е включен) |
| GitHub Pages (`.github/workflows/static.yml`) | push към `main` (т.е. всеки merge) | Само статичен frontend, без backend — legacy; не го бъркай с Vercel |

`refactor/catalog-foundation` се синхронизира от `main` **само** при изрично одобрен
deploy (fast-forward/merge commit с tree == `main`, без force-push). Смяната на
Vercel Production Branch към `main` е отделна hosting промяна (§4.4).

### Известни рискове (към 2026-09-23 — провери отново)

- `main` **не е защитен** в GitHub (branch protection е изключен). Локалната защита е
  само `.claude/settings.json` + hook. Включването на protection е решение на собственика.
- **Migration drift:** live проектът има `20260923125258_fix_rls_auth_initplan_plants`,
  който липсва в `supabase/migrations/`. Не го прилагай и не го „пресъздавай“ наизуст —
  експортът му в repo изисква точния SQL и одобрение.
- Supabase security advisor: *Leaked Password Protection Disabled* (Auth настройка → §4.7).
- `File_017.png` и `IMG_5512.jpg` в Storage са orphan снимки с недовършена/противоречива
  ботаническа проверка (`data/review-results.json` срещу `.bak`, `full_qa.md`,
  `fix_log.txt`). Не ги трий/презаписвай; не пускай `scripts/bulk-import-orphan-photos.js`
  без изрично одобрение — създава дублирани записи.

## 3. Команди (проверени спрямо `package.json` и `quality.yml`)

```bash
npm ci                                   # точни dependencies от lockfile
npm run dev                              # node server.js, PORT (default 3000); нужен е локален .env
npm run lint                             # scripts/qa/check-syntax.js — node --check на tracked JS
npm test                                 # node --test tests/*.test.js
npm run build                            # no-op (няма build стъпка)
node scripts/qa/validate-plant-data.js   # read-only; 0 локални записа е нормално (каталогът е в Supabase)
node --test tests/plant-data-validation.test.js
node scripts/qa/scan-secrets.js
npm run test:e2e                         # Playwright; виж SKILL.md за cloud-container бележки
```

CI (`.github/workflows/quality.yml`): lint → test → validator → validator test → secret
scan; пуска се на всеки pull request и на push към `main` и `refactor/catalog-foundation`.
Skill `pre-merge-verify` изпълнява същите проверки локално.

## 4. Твърди граници (never без изрично одобрение на конкретния обхват)

```text
1.  Никога не commit-вай и не push-вай директно в `main`; никога force-push или
    history rewrite на `main`. Промени влизат само през PR, merge-нат от собственика.
2.  Никога не merge-вай pull request (и не включвай auto-merge).
3.  Никога не force-push-вай, не пренаписвай история, не squash-вай споделени commits.
4.  Никога не създавай production/preview deployment и не променяй hosting/build/domain/
    environment configuration (Vercel, GitHub Pages или друга платформа). Push към
    `refactor/catalog-foundation` Е production deploy.
5.  Никога не показвай, не commit-вай, не логвай и не искай съдържание на .env, API keys,
    tokens, passwords, cookies, database URLs, OAuth codes или Supabase service-role key.
6.  Никога не поставяй server-side secret или service-role key в client/browser код.
7.  Никога не променяй Supabase schema, migrations, tables, RLS policies, Auth конфигурация,
    bucket visibility, Storage policies или Edge Functions без изрично одобрение с точен SQL/diff.
8.  Никога не изпълнявай INSERT/UPDATE/DELETE/ALTER/DROP към production данни или
    storage write/delete без изрично одобрение и rollback план.
9.  Никога не трий, презаписвай или трансформирай original image, plant record,
    legacy файл, remote branch или cloud ресурс без изрично одобрение и trace-верификация.
10. Никога не инсталирай нов package/dependency, plugin, MCP server или CLI, не добавяй
    SaaS/API provider, не създавай external account и не приемай terms без одобрение.
11. Никога не променяй GitHub Actions workflows или CodeQL конфигурация без изрично одобрение.
12. Никога не обработвай bulk legacy снимки и не викай платен/credit-consuming AI provider
    (Gemini workflows, `/api/qa`) извън изрично одобрен, ограничен evaluation spike.
13. Никога не представяй AI/API идентификация или таксономично предложение като
    потвърден научен факт — винаги маркирай provenance
    (manual / source-suggested / editor-confirmed / needs-review).
14. Никога не давай заключения за ядливост, токсичност или лечебна употреба
    само от снимка или AI резултат.
```

За всяко действие от списъка: спри и покажи точния план (файлове, diff/SQL/команди,
тестове, rollback). Общо „давай“ или „оправи всичко“ не е одобрение.

Техническа защита: `.claude/settings.json` (deny/ask правила) и
`.claude/hooks/guard-bash.js` (блокира четене на `.env`/ключове, dump на environment,
force-push, изтриване на remote branch и push към `main`). Не ги заобикаляй и не ги
отслабвай без изрично одобрение.

## 5. Работен цикъл: план → QA → изпълнение → QA

Извън §4 работи автономно. Питай само когато: (а) не можеш да провериш нещо сам,
(б) стъпката е от §4, (в) изборът е продуктова преценка.

- **План:** read-only inventory на релевантните файлове; най-малкият план. Не гадай
  schema, endpoint, dependency или data contract — провери в кода/connector-а.
- **QA на плана:** обхват, data safety, security, backward compatibility (legacy
  снимки/записи), cost, testability, botanical integrity.
- **Изпълнение:** един логически проблем = един commit. Максимум 3 опита с нова
  хипотеза за един defect; след това root-cause report. При липсващ достъп:
  `[BLOCKED: <причина>. Safe fallback: <действие>.]` и продължи с независима работа.
- **QA на изпълнението:** diff обхват, targeted tests, regression, data integrity,
  security, UX states (loading/success/failure/empty/unauthorized), provenance, rollback.
  Никога не отслабвай тест/assertion, за да мине.

## 6. Git workflow

```text
1. git fetch origin; нов branch от origin/main: <type>/<кратко-име>
   (fix/, feat/, chore/, docs/, test/, refactor/; Claude cloud сесии — claude/…).
2. Малки, фокусирани commits; conventional commit съобщения; stage по изричен път
   (никога `git add .` / `git add -A`).
3. Преди push: skill `pre-merge-verify` (или агент `qa-verifier`) — всичко PASSED.
4. git push -u origin <branch> (никога main, никога --force).
5. Draft PR към main с: обхват, файлове, data impact, validation, рискове, rollback.
6. Merge прави само собственикът. Deploy = отделно одобрена синхронизация на
   refactor/catalog-foundation (§2).
```

Не смесвай data/schema, UI, image processing и QA в един commit.

## 7. Definition of Done

- [ ] Промяната е само в обещаните файлове; `git diff --check` е чист.
- [ ] `npm run lint`, `npm test`, validator, validator test и `scan-secrets` — PASSED.
- [ ] Targeted тест за променения behavior (нов или обновен), mock-нати външни API
      (GBIF, Pl@ntNet, iNaturalist); никакви тестови данни в production Supabase.
- [ ] Няма нови dependencies, secrets, schema/RLS/Storage или hosting промени без одобрение.
- [ ] Legacy снимки/записи са запазени; ботаническите твърдения имат provenance.
- [ ] Draft PR с validation резултати и точен rollback; CI е зелен.

Минимални e2e цели: catalog load, search/filter, image fallback, editor form, invalid
upload, valid upload preview, unauthorized write protection, mobile viewport.

## 8. Supabase политика

- Read-only discovery е свободно: `list_tables`, `list_migrations`, `get_advisors`,
  `list_edge_functions`, `search_docs`, logs.
- Проектният MCP сървър (`.mcp.json`, име `supabase`) е в `read_only=true` режим, само
  с features `docs,database,debugging,development,functions`. Не добавяй втори
  Supabase MCP сървър и не махай `read_only` без изрично одобрение.
- `execute_sql` винаги пита (дори SELECT); всяка schema/RLS промяна минава през
  `supabase/migrations/` файл + точен SQL + одобрение + verify
  (skill `supabase-postgres-best-practices`; агент `supabase-security-reviewer` за review).
- `apply_migration`, branch/project операции и `deploy_edge_function` са забранени в settings.

## 9. Connectors и MCP

- Използвай connectors проактивно за **read-only** проверка на live състояние
  (GitHub PRs/CI/branches, Supabase metadata/advisors, Vercel deployments) вместо да
  гадаеш от стари документи.
- Write-capable remote tools (merge, deploy, env vars, domains, migrations, SQL writes,
  branch delete) са забранени или изискват изрично одобрение — виж `.claude/settings.json`.
- Никога не чети Vercel env values или токени през connector.
- Ако connector не се свързва — `[BLOCKED: …]`, не заключавай, че ресурсът не съществува.

## 10. Ботанически данни и provenance

- AI/API резултатите са предложения: статус `needs-review` или `source-suggested`,
  докато редактор не потвърди (`editor-confirmed`).
- Научните имена се проверяват спрямо източник (GBIF), с отбелязан източник.
- Несигурна идентификация се показва като несигурна. Без твърдения за ядливост,
  токсичност или лечебна употреба без подкрепена идентификация и подходящ източник.
- Виж `docs/BOTANICAL_POLICY.md` и `BOTANICAL_VERIFICATION.md`.

## 11. Формат на отговор

- **Справки/въпроси:** кратък директен отговор.
- **Промени в код/данни/конфигурация:** 1) Извод 2) План 3) QA на плана 4) Изпълнение
  (реални файлове, команди, резултати, commit-и) 5) QA на изпълнението (pass/fail/blocked)
  6) Нужно действие от собственика (само реални approval gates) 7) Статус
  (completed / partial / blocked / awaiting approval).
- Финален отчет включва: Completed (файлове, SHA, тестове), Not changed, Blocked,
  QA, Rollback и потвърждение: без push/force-push към main, без merge, без deploy,
  без неодобрени schema/RLS/Storage/data writes, без изложени secrets, без AI резултат
  представен като потвърден факт.

## 12. Начало на всяка сесия

Изпълни skill `audit-readonly`: branch/статус, отворени PR (`state=all`, flag-ни
остарели/дублирани и припокриващи се), CI, Supabase migration drift и advisors,
Vercel production SHA спрямо `main`. Върни кратък baseline и продължи по най-високия
безопасен приоритет:

```text
P0 — auth/login, add/edit, upload и показване на снимки, preview/production ↔ Supabase
     съответствие, broken-image fallback, mobile usability.
P1 — image foundation: original/optimized/thumbnail, provenance, targeted tests.
P2 — ботанически data quality: GBIF autocomplete/cache, taxonomy provenance,
     Pl@ntNet opt-in, iNaturalist read-only контекст.
P3 — само след стабилна основа: ограничен AI image-enhancement spike.
```

# AGENTS.md — digital-flora-googleai

Кратко ръководство за AI инструменти (Claude Code, Cursor, GitHub Copilot) и хора, работещи по този проект. Описва реалния текущ стек — не предполагай друго и не цитирай по-стари версии на този файл.

## Стек на проекта (важно — не предполагай друго)

- **Frontend:** чист HTML/CSS/JavaScript (`index.html`), без React/Vue/Next.js
- **Backend:** Node.js + **Express** (`server.js`) — истинска framework абстракция (routes, middleware chains: `helmet`, `express-rate-limit`, custom auth middleware), не "гол" `http` модул
- **База данни / storage:** **Supabase** (Postgres + Auth + Storage) е установеният и единствен активен източник — виж `src/db/plants.js` (read), `src/db/supabase-catalog.js` (write), `src/storage/supabase-images.js` (Storage). Firebase/Firestore **не съществуват** в кода (`firebase-client.js`, `firestore.rules` са премахнати) — миграцията е приключена, не "в процес"
- **PWA:** service worker (`sw.js`, network-first за HTML), `manifest.json`
- **Помощни скриптове:** предимно Node (`scripts/check-write-role.js`, `scripts/qa/validate-plant-data.js`, `scripts/qa/scan-secrets.js`); също **два legacy Python скрипта** (`scripts/analyze_review.py`, `scripts/stage_existing_review_images.py`) за review-batch обработка на снимки — не пипай/разширявай без нужда, не са част от runtime пътя
- **Тестове:** `node --test` (unit, `tests/*.test.js`) + Playwright (`tests/e2e/`, `npm run test:e2e`)
- **Lint:** само `node --check server.js` (`npm run lint`) — няма ESLint/Prettier конфигурация в проекта, не добавяй такава без изрично одобрение (CLAUDE.md правило 10)

Не предлагай автоматично React компоненти, Next.js структура, нови Python scaffolding скриптове или TypeScript конфигурации — не съответстват на този проект, освен ако изрично не е поискано мигриране на стека.

## Активни проектни контракти

- Работен branch: `refactor/catalog-foundation`. PR #1 → `main` остава **Draft**, никога не се merge-ва автономно. `main` е защитен.
- Пълните твърди граници, работен цикъл и приоритети са в `CLAUDE.md` в root-а на repo-то — той е меродавният документ за git/security/QA дисциплина. Този файл (`AGENTS.md`) описва само стека и конвенциите за код.

## Backend сигурност — чеклист преди merge

- [ ] Няма hardcoded API ключове / Supabase credentials (URL, anon/service-role key) в кода — само през `.env` / environment variables
- [ ] Никакъв Supabase **service-role key** в browser/client код (`index.html`) — само anon/publishable key, ако изобщо е нужен client-side
- [ ] CORS е ограничен до конкретни origins, не `*`, ако endpoint-ът пише данни
- [ ] Rate limiting (`express-rate-limit`) на публични endpoints, които пишат в базата
- [ ] Входни данни се валидират преди запис (тип, дължина, задължителни полета)
- [ ] Грешките връщат консистентен формат, не голи stack traces към клиента
- [ ] Промяна в Supabase RLS policy или schema — само с изрично одобрение и точен SQL/diff (CLAUDE.md правило 7)

**Стандартен формат за грешка (препоръчителен):**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Кратко, ясно описание на проблема"
  }
}
```

## Supabase RLS — принципи

- Никога напълно отворена RLS политика (`USING (true)` за write) в production
- Read достъпът може да е широк (публичен каталог), но write трябва да изисква поне auth или валидация на структурата на реда
- Преди всяка промяна в RLS policy — тествай locally/staging, никога директно в production, и следвай точната последователност write → test → apply → verify

## Git workflow

```bash
# Feature branch, ако не работиш директно в refactor/catalog-foundation
git checkout -b fix/plant-data-cleanup

# Conventional commits
git commit -m "fix(catalog): correct botanical name mismatch in editPlant()"
git commit -m "feat(qa): add validation step to validate-plant-data.js"
git commit -m "docs: update AGENTS.md with current stack"
```

Push само към `refactor/catalog-foundation` (или изрично одобрен feature branch от него), не към `main`. Едно commit = една техническа цел — не смесвай data/schema, UI, image processing и QA в един commit.

## UI/Design принципи (за index.html)

Тъй като проектът е чист HTML/CSS без design system библиотека:

- **Един доминиращ цвят (60%) + един акцентен (10%)** — не разпределяй цветовата палитра равномерно, акцентът трябва да изпъква (напр. CTA бутони)
- **Типография:** избягвай default system фонтове само за heading-и; един display font за заглавия + един четим body font е достатъчно — не е нужна сложна pairing система
- **Контраст:** минимум 4.5:1 за обикновен текст (WCAG AA) — важно за снимки на растения с overlay текст
- **Мобилна четимост:** каталогът вероятно се разглежда и на телефон по време на туристически преход — тествай на 320px ширина

## Роля на GitHub Copilot Pro в този проект

Copilot Pro получава само изолирани, добре ограничени задачи през Issue/PR — работи в собствен `copilot/` branch, отваря Draft PR, не push-ва към `main`, не merge-ва сам.

**Подходящи задачи:**
- Unit tests за нови/съществуващи API endpoints (напр. `POST /api/plants` — missing auth header, non-editor role, валиден editor)
- Test coverage за upload flow (bulk upload с валидни и невалидни файлове)
- `.github/ISSUE_TEMPLATE/` шаблони
- README документация за upload/verification flow
- CI workflow промени за съществуващи QA скриптове/тестове (без deploy step, без промяна на CodeQL конфигурация)

**НЕ подходящи задачи (изискват широк контекст и решения, не изолирана промяна):**
- Промяна на Supabase schema/RLS policies
- "Направи production-ready"
- Масово изчистване на dead files
- Общо "оправи security проблемите"
- Каквото и да е от твърдия stop list в `CLAUDE.md` (§9)

## Как да ползвате този файл

- **GitHub Copilot Pro:** автоматично прочита repository контекста при всяка възложена Issue/PR задача, включително този файл.
- **Claude Code / Cursor:** root-level `AGENTS.md` се четe автоматично като контекст за проекта — но `CLAUDE.md` има приоритет при конфликт по git/security/QA дисциплина.
- **Ръчно (Perplexity, ChatGPT и др.):** прикачи файла към разговора, когато искаш AI да следва тези конвенции.

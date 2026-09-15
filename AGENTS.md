# AGENTS.md — digital-flora-googleai

Кратко ръководство за AI инструменти (Claude Code, Cursor, GitHub Copilot) и хора, работещи по този проект. Извадено и адаптирано от три по-обемни "super-skill" референтни файла — само частите, релевантни за реалния стек на проекта.

## Стек на проекта (важно — не предполагай друго)

- **Frontend:** чист HTML/CSS/JavaScript (`index.html`), без React/Vue/Next.js
- **Backend:** Node.js (`server.js`), без TypeScript, без Express framework abstraction отгоре
- **База данни / storage:** Firebase / Firestore (`firestore.rules`, `firebase-client.js`) — в процес на миграция към Supabase (виж `supabase-migration-instructions.txt`)
- **PWA:** service worker (`sw.js`), `manifest.json`
- **Помощни скриптове:** обикновени Node скриптове (`fix_all_plants.js`, `qa.js`, `compare.js` и др.), не Python

Не предлагай автоматично React компоненти, Next.js структура, Python scaffolding скриптове или TypeScript конфигурации — те не съответстват на този проект, освен ако изрично не поискано мигриране на стека.

## Активни проектни контракти

- `supabase-migration-instructions.txt` — Firebase→Supabase миграция (schema, auth, storage). Работен branch: `refactor/catalog-foundation`. PR #1 остава Draft. `main` е защитен.
- `fallow-cleanup-instructions.txt` — dead-code и dependency cleanup, паралелно и без противоречие с Supabase миграцията.

## Backend сигурност — чеклист преди merge

- [ ] Няма hardcoded API ключове / Firebase/Supabase credentials в кода — само през `.env` / environment variables
- [ ] CORS е ограничен до конкретни origins, не `*`, ако endpoint-ът пише данни
- [ ] Rate limiting на публични endpoints, които пишат в базата (защита от спам/абюз)
- [ ] Входни данни се валидират преди запис (тип, дължина, задължителни полета)
- [ ] Грешките връщат консистентен формат, не голи stack traces към клиента
- [ ] Никакъв Supabase service-role key в browser/client code

**Стандартен формат за грешка (препоръчителен):**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Кратко, ясно описание на проблема"
  }
}
```

## Firestore/Supabase правила — принципи

- Никога `allow read, write: if true;` (Firestore) или напълно отворена RLS политика (Supabase) в production
- Read достъпът може да е широк (публичен каталог), но write трябва да изисква поне auth или валидация на структурата на документа/реда
- Преди всяка промяна в `firestore.rules` или Supabase RLS policy — тествай локално/emulator, не директно в production

## Git workflow

```bash
# Feature branch
git checkout -b fix/plant-data-cleanup

# Conventional commits
git commit -m "fix(data): correct botanical name mismatches in fix_all_plants.js"
git commit -m "feat(qa): add validation step to qa.js"
git commit -m "docs: update AGENTS.md with Firestore rules"
```

Push само към `refactor/catalog-foundation`, не към `main`. Едно commit = една техническа цел — не смесвай Firebase removal, dependency update, schema change, auth, storage в един commit.

## UI/Design принципи (за index.html)

Тъй като проектът е чист HTML/CSS без design system библиотека:

- **Един доминиращ цвят (60%) + един акцентен (10%)** — не разпределяй цветовата палитра равномерно, акцентът трябва да изпъква (напр. CTA бутони)
- **Типография:** избягвай default system фонтове само за heading-и; един display font за заглавия + един четим body font е достатъчно — не e нужна сложна pairing система
- **Контраст:** минимум 4.5:1 за обикновен текст (WCAG AA) — важно за снимки на растения с overlay текст
- **Мобилна четимост:** каталогът вероятно се разглежда и на телефон по време на туристически преход — тествай на 320px ширина

## Роля на GitHub Copilot Pro в този проект

Copilot Pro получава само изолирани, добре ограничени задачи през Issue/PR — работи в собствен `copilot/` branch, отваря Draft PR, не push-ва към `main`, не merge-ва сам.

**Подходящи задачи:**
- Unit tests за нови/съществуващи API endpoints (напр. `POST /api/plants` — missing auth header, non-editor role, валиден editor)
- Test coverage за upload flow (bulk upload с валидни и невалидни файлове)
- `.github/ISSUE_TEMPLATE/` шаблони
- README документация за upload/verification flow
- Lint/format конфигурация (без промяна на dependency версии)
- CI workflow за съществуващи QA скриптове/тестове (без deploy step)

**НЕ подходящи задачи (изискват широк контекст и решения, не изолирана промяна):**
- Пълна Supabase миграция
- Пълно Firebase премахване
- "Направи production-ready"
- Масово изчистване на dead files
- Общо "оправи security проблемите"

## Какво НЕ пренасяме от оригиналните super-skill референтни файлове

- MCP сървъри, RAG пайплайни, multi-agent оркестрация — няма AI-агент компонент в проекта в момента
- React/shadcn/Next.js workflow-и — грешен стек
- Python scaffolding скриптове (`architecture_diagram_generator.py` и др.) — няма Python в проекта
- Видео/аудио генериране, брандинг архетипове — извън обхвата на ботаническия каталог

## Как да ползвате този файл

- **GitHub Copilot Pro:** автоматично прочита repository контекста при всяка възложена Issue/PR задача, включително този файл.
- **Claude Code / Cursor:** root-level `AGENTS.md` се четe автоматично като контекст за проекта.
- **Ръчно (Perplexity, ChatGPT и др.):** прикачи файла към разговора, когато искаш AI да следва тези конвенции.

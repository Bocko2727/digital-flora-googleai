# Recap — нощен одит 2026-09-26/27 (PR #37)

## Какво открих
- **Production е паднал** от 2026-09-26 07:52 UTC: домейните сочат към `main@6a6d744`, който дава 500 на всяка заявка (`Cannot find package 'express'`). Причината е, че Vercel пропуска install стъпката. Поправката (#36) беше merge-ната в грешен branch, не в `main`.
- `SUPABASE_DB_URL` в production сочи към IPv6-only хоста `db.<ref>.supabase.co`. Затова от Vercel има `ENOTFOUND`, whoami и всеки запис връщат 500, а редакторът се показва като „viewer“.
- В `main` има счупен UTF-8 от commit `68a3bc9` (бутонът „Запази промените“ е с изпочупени символи). Това чупи 4 e2e теста.
- Production Branch вече е `main`, т.е. **всеки merge е deploy**. Документацията още посочваше `refactor/catalog-foundation`.
- Supabase↔Vercel интеграцията е с грешен префикс (`sb_publishable_…_*`). В Preview стойностите ѝ са невалидни.

## Какво направих (branch `claude/automated-audit-fixes-fzir72`, PR #37, draft)
1. `vercel.json` (`npm ci`) + `export default app`. Проверено на Vercel preview: install минава и `/health` връща 200.
2. Поправих UTF-8 текста и добавих тест, който хваща U+FFFD в CI.
3. Добавих Data API fallback за роля, запис и снимки, когато Postgres е недостъпен. При срив връщаме 503 вместо 500. `sslmode` вече не override-ва TLS, а `verify-full` запазва проверката. Добавих и предупреждение за IPv6 хоста.
4. UI показва „ролята не е достъпна“, вместо фалшиво „viewer“.
5. Обнових документацията (CLAUDE.md, AGENTS.md, SKILL.md, DEPLOYMENT.md, `.env.example`, NEXT_PROMPT).

**Резултати:** unit тестове 71/71 (преди 31), e2e 54/54 (преди 42/50), lint и secret scan са чисти, security review е минат. Няма промени по schema, RLS, env, данни или deploy.

## Какво остава — решения на собственика
1. **Прегледай и merge-ни PR #37.** Това е production deploy и поправя срива. Докато решиш, може да направиш Promote на `dpl_EN29n47j9AKHRtY5ubdxUQqpkV7d` във Vercel.
2. Смени `SUPABASE_DB_URL` (Production) на Transaction pooler URI: `aws-*.pooler.supabase.com:6543`, потребител `postgres.<ref>`.
3. Оправи или преинсталирай Supabase интеграцията без префикс. Реши дали Preview да има Supabase env.
4. Кажи „да“ за зачистване на: PR #5, `v0/fix-preview-env-loading` (не го merge-вай), стари branch-ове, `refactor/catalog-foundation`.
5. Незадължително: e2e в CI (изисква промяна на workflow) и Deployment Protection за previews.

## Следваща стъпка
Провери дали #37 е merge-нат и дали production `/health` връща 200. После продължи по `docs/handoff/NEXT_PROMPT.md` (задачи B, E, F2, G).

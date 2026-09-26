---
name: run-digital-flora
description: Build, run, and drive the Digital Flora catalog (Express server + vanilla JS PWA). Use when asked to start or run the app, launch the server, take a screenshot of the UI, click through the catalog/search/detail view, check it on mobile, or run the unit and Playwright tests.
---

Digital Flora is `server.js` (Express) serving a vanilla-JS PWA. An agent drives it with
`.claude/skills/run-digital-flora/driver.mjs`: the script starts the server **with the
Supabase/AI env vars stripped**, runs a real user flow in headless Chromium (Playwright), saves
screenshots and exits non-zero on failure. Paths below are relative to the repo root.

## Prerequisites (once per container)

```bash
npm ci                                  # exact lockfile; provides @playwright/test
npx playwright install chromium         # ~115 MiB headless shell -> ~/.cache/ms-playwright
sudo npx playwright install-deps chromium   # system libs (libatk etc.) via apt
```

## Run (agent path)

```bash
node .claude/skills/run-digital-flora/driver.mjs
node .claude/skills/run-digital-flora/driver.mjs --mobile --search мак --out /tmp/flora-shots/mobile
```

Flow: open `/` → wait for `.plant-card` → report card/image counts → type in `#searchInput`
→ click the first card → wait for `#modal.open` → screenshot at each step → print console
errors, page errors and HTTP 5xx. Expected output on a healthy build:

```text
GET / -> 200
cards: 12 | counter: Показани 1–12 от 80 образеца (Общо в хербария: 80)
card images: 11 loaded, 1 fallback, 0 pending (lazy, off-screen)
search "Papaver": 1 card(s)
modal: × | Червен мак
errors: none
```

Screenshots → `/tmp/flora-shots/{01-catalog,02-search,03-detail}.png` (`failure.png` on error).
Server log → `/tmp/flora.log`. **Open the PNGs and look at them** before claiming success.

| flag | effect |
|---|---|
| `--search <text>` | search term (default `Papaver`); Bulgarian or Latin |
| `--mobile` | Playwright `Pixel 7` device profile |
| `--out <dir>` | screenshot directory (default `/tmp/flora-shots`) |
| `--port <n>` | port for the server it starts (default 3100) |
| `BASE_URL=...` env | drive an already-running server instead of starting one |

### Server only (for curl / API work)

```bash
(env -u SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY PORT=3100 node server.js &> /tmp/flora.log &)
timeout 20 bash -c 'until curl -sf -o /dev/null http://127.0.0.1:3100/health; do sleep 0.3; done'
curl -s http://127.0.0.1:3100/health            # {"status":"ok","uptime":...}
curl -si http://127.0.0.1:3100/api/plants | grep -i x-catalog   # X-Catalog-Source: archive-fallback
curl -s http://127.0.0.1:3100/api/config        # {"supabaseUrl":null,"supabasePublishableKey":null}
lsof -ti:3100 -sTCP:LISTEN | xargs -r kill      # stop
```

## Test

```bash
npm test                                              # 28 pass
env -u SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY npm run test:e2e   # 46 pass, 4 screenshot specs fail (see Gotchas)
```

## Gotchas

- **The Codespace has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in its environment**
  (Codespaces secrets), with no `.env` file. A bare `node server.js` inherits the
  **production service-role key**, so Storage writes would hit production. Always strip them
  (`env -u …`); the driver strips every Supabase/Gemini/Kilo variable itself. Check which are set
  by name only: `[ -n "${SUPABASE_URL+x}" ] && echo set`. Never print values.
- **Without the DB URL the catalog is the read-only archive** (80 plants,
  `X-Catalog-Source: archive-fallback`, yellow "Живият каталог (Supabase) не е достъпен" banner).
  This is the intended safe mode for driving the UI. Edit/delete buttons still render in the
  modal but cannot write.
- **Photos always come from production Storage.** `resolvePhotoUrl` in `app.js` hardcodes
  `https://sxuxtsbyqjaodyuqebux.supabase.co/storage/v1/object/public/plant-images/`, so images
  are real public GETs even in archive mode and need outbound network. One archive record
  (`Vitex agnus-castus`, `IMG_5521.jpg`) shows the `/icon.svg` fallback. That is expected and is
  the "1 fallback" in the output.
- **Card images are `loading="lazy"`.** A screenshot right after the cards appear shows grey
  placeholders. The driver waits for `networkidle` first. On mobile, cards below the fold stay
  "pending" (expected).
- **`tests/e2e/screenshots.spec.js` fails locally by design.** Baselines are deliberately not
  committed (they must be generated on CI). The first run writes
  `tests/e2e/screenshots.spec.js-snapshots/` and reports 4 failures. Do not commit that folder.
- **The repo's bash hook blocks any command containing `.env`**, including `ls .env`. Use
  `.env.example` for variable names.
- `API key should be set when using the Gemini API.` (twice) in `/tmp/flora.log` is harmless
  with keys stripped. AI endpoints are simply unavailable.

## Troubleshooting

- **`chrome-headless-shell: error while loading shared libraries: libatk-1.0.so.0`**: browser
  system libs are missing. Run `sudo npx playwright install-deps chromium`. The driver prints
  `chromium did not start: …`, exits 2 and stops the server it started.

#!/usr/bin/env node
// Drive the Digital Flora catalog in headless Chromium and save screenshots.
//
//   node .claude/skills/run-digital-flora/driver.mjs            # start server, smoke flow, stop
//   node .claude/skills/run-digital-flora/driver.mjs --search Papaver --mobile
//   BASE_URL=http://127.0.0.1:3100 node .../driver.mjs          # reuse a server you started
//
// The server it starts runs with the Supabase/AI env vars REMOVED, so the
// catalog is served read-only from the bundled archive (X-Catalog-Source:
// archive-fallback) and nothing can reach production Supabase (CLAUDE.md §4.8).
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};

const PORT = Number(opt('port', process.env.PORT_DRIVER || 3100));
const OUT = opt('out', '/tmp/flora-shots');
const SEARCH = opt('search', 'Papaver');
const SECRET_VARS = [
  'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_DB_URL', 'SUPABASE_DB_CA_CERT', 'GEMINI_API_KEY', 'GOOGLE_API_KEY',
  'GOOGLE_GENAI_API_KEY', 'KILO_API_KEY', 'KILO_KEY', 'KILO_CODE', 'KILO_BASE_URL', 'KILO_MODEL',
];

async function waitFor(url, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server did not answer ${url} within ${ms}ms (see /tmp/flora.log)`);
}

let server;
let base = process.env.BASE_URL;
if (!base) {
  base = `http://127.0.0.1:${PORT}`;
  const env = { ...process.env, PORT: String(PORT) };
  for (const v of SECRET_VARS) delete env[v];
  const { openSync } = await import('node:fs');
  const log = openSync('/tmp/flora.log', 'w');
  server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: ['ignore', log, log] });
  await waitFor(`${base}/health`);
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch().catch((e) => {
  if (server) server.kill(); // don't leave the server holding the port
  console.error(`chromium did not start: ${e.message.split('\n').find((l) => l.includes('error while loading')) || e.message.split('\n')[0]}`);
  process.exit(2);
});
const context = await browser.newContext(flag('mobile') ? devices['Pixel 7'] : { viewport: { width: 1366, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('response', (r) => { if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`); });

const shot = async (name) => {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`screenshot ${file}`);
};

let exitCode = 0;
try {
  const res = await page.goto(base, { waitUntil: 'domcontentloaded' });
  console.log(`GET / -> ${res.status()}`);
  await page.locator('.plant-card').first().waitFor({ timeout: 15000 });
  console.log(`cards: ${await page.locator('.plant-card').count()} | counter: ${(await page.locator('#counterText').innerText()).trim()}`);
  // Card <img> tags are loading="lazy" (app.js); give the in-viewport ones time to decode.
  await page.waitForLoadState('networkidle').catch(() => {});
  const imgs = await page.$$eval('.plant-card-img', (els) => els.map((i) => ({
    ok: i.complete && i.naturalWidth > 0, fallback: i.getAttribute('src') === i.dataset.fallback,
  })));
  console.log(`card images: ${imgs.filter((i) => i.ok && !i.fallback).length} loaded, ${imgs.filter((i) => i.fallback).length} fallback, ${imgs.filter((i) => !i.ok).length} pending (lazy, off-screen)`);
  await shot('01-catalog');

  await page.locator('#searchInput').fill(SEARCH);
  await page.waitForTimeout(400); // search input is debounced
  const hits = await page.locator('.plant-card').count();
  console.log(`search "${SEARCH}": ${hits} card(s)`);
  await shot('02-search');

  if (hits > 0) {
    await page.locator('.plant-card').first().click();
    await page.locator('#modal.open').waitFor({ timeout: 5000 });
    console.log(`modal: ${(await page.locator('#modal').innerText()).split('\n').filter(Boolean).slice(0, 2).join(' | ')}`);
    await shot('03-detail');
  }
} catch (e) {
  exitCode = 1;
  console.error(`FAILED: ${e.message}`);
  await shot('failure').catch(() => {});
} finally {
  if (errors.length) console.log(`errors:\n  ${errors.join('\n  ')}`);
  else console.log('errors: none');
  await browser.close();
  if (server) server.kill();
}
process.exit(exitCode);

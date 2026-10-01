import { randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const plantsFixture = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures', 'plants.json'), 'utf8')
);

// 25 items - more than either #pageSizeSelect option (12/24) - for exercising
// multi-page pagination state, which the default 3-item fixture can't.
export const plantsPaginatedFixture = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures', 'plants-paginated.json'), 'utf8')
);

// Intercepts all Supabase/backend calls the catalog page makes so tests never
// touch the real Supabase project (data safety: CLAUDE.md §7 forbids writing
// test data to production Supabase). GET /api/plants serves the fixture;
// /api/config is neutered so the real Supabase Auth SDK never initializes.
//
// Each page also gets its own client IP. The whole suite talks to one
// `node server.js` from 127.0.0.1, so without this every test shares one
// static-asset rate-limit bucket (600 requests / 5 min, ~9 per page load)
// and the last specs get a 429 page once the suite is big enough. server.js
// trusts one proxy hop, so X-Forwarded-For sets req.ip. Rate limiting is not
// what these specs test.
export async function mockCatalogApi(page, { plants = plantsFixture } = {}) {
  await page.setExtraHTTPHeaders({
    'X-Forwarded-For': `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`,
  });
  await page.route('**/api/config', (route) =>
    route.fulfill({ json: { supabaseUrl: null, supabasePublishableKey: null } })
  );
  await page.route('**/api/plants', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: plants });
    }
    return route.continue();
  });
}

// Signed-in UI states without touching the real Supabase project:
// /api/config points supabase-js at the project host, a fake unexpired
// session is seeded into localStorage (supabase-js restores it without a
// network call), every request to the Supabase host is answered locally with
// a 503, and /api/auth/whoami is answered by the `whoami` handler. Returns
// the Authorization headers whoami received.
const SUPABASE_URL = 'https://sxuxtsbyqjaodyuqebux.supabase.co';
const STORAGE_KEY = 'sb-sxuxtsbyqjaodyuqebux-auth-token';
export const signedInUser = { id: 'b3c7a0de-5a4f-4a9c-8f7e-2d1c9e0f1a2b', email: 'editor@example.com', aud: 'authenticated', role: 'authenticated' };

export async function openSignedIn(page, whoami) {
  const whoamiAuthHeaders = [];
  await page.route('**/api/config', (route) => route.fulfill({ json: { supabaseUrl: SUPABASE_URL, supabasePublishableKey: 'sb_publishable_e2e' } }));
  await page.route('**/api/plants', (route) => (route.request().method() === 'GET' ? route.fulfill({ json: plantsFixture }) : route.abort()));
  await page.route(`${SUPABASE_URL}/**`, (route) => route.fulfill({ status: 503, json: { message: 'e2e: no Supabase access' } }));
  await page.route('**/api/auth/whoami', (route) => {
    whoamiAuthHeaders.push(route.request().headers().authorization);
    return whoami(route);
  });
  const session = {
    access_token: 'e2e-access-token', token_type: 'bearer', expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'e2e-refresh-token', user: signedInUser,
  };
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [STORAGE_KEY, JSON.stringify(session)]);
  await page.goto('/');
  return whoamiAuthHeaders;
}

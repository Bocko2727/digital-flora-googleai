import { test, expect } from '@playwright/test';
import { plantsFixture } from './helpers.js';

// Signed-in UI states without touching the real Supabase project:
// /api/config points supabase-js at the project host, a fake unexpired
// session is seeded into localStorage (supabase-js restores it without a
// network call), every request to the Supabase host is answered locally with
// a 503, and /api/auth/whoami is mocked per test.
const SUPABASE_URL = 'https://sxuxtsbyqjaodyuqebux.supabase.co';
const STORAGE_KEY = 'sb-sxuxtsbyqjaodyuqebux-auth-token';
const USER = { id: 'b3c7a0de-5a4f-4a9c-8f7e-2d1c9e0f1a2b', email: 'editor@example.com', aud: 'authenticated', role: 'authenticated' };

async function openSignedIn(page, whoami) {
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
    expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'e2e-refresh-token', user: USER,
  };
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [STORAGE_KEY, JSON.stringify(session)]);
  await page.goto('/');
  return whoamiAuthHeaders;
}

test('an editor is shown with the role and the write actions', async ({ page }) => {
  const authHeaders = await openSignedIn(page, (route) => route.fulfill({ json: { id: USER.id, email: USER.email, role: 'editor' } }));
  await expect(page.locator('#authContainer .user-name')).toHaveText('editor@example.com (editor)');
  await expect(page.locator('#writeActions')).toBeVisible();
  expect(authHeaders[0]).toBe('Bearer e2e-access-token');
});

test('when the server cannot check the role, the UI says so instead of showing "viewer"', async ({ page }) => {
  await openSignedIn(page, (route) => route.fulfill({ status: 503, json: { error: 'Catalog authorization is temporarily unavailable.', code: 'CATALOG_AUTH_UNAVAILABLE' } }));
  const label = page.locator('#authContainer .user-name');
  await expect(label).toHaveText('editor@example.com (ролята не е достъпна)');
  await expect(label).toHaveAttribute('title', /не можа да провери ролята/);
  await expect(page.locator('#writeActions')).toBeHidden();
});

test('a viewer is still shown as viewer, without write actions', async ({ page }) => {
  await openSignedIn(page, (route) => route.fulfill({ json: { id: USER.id, email: USER.email, role: 'viewer' } }));
  await expect(page.locator('#authContainer .user-name')).toHaveText('editor@example.com (viewer)');
  await expect(page.locator('#writeActions')).toBeHidden();
});

test('logging out clears the unavailable-role state', async ({ page }) => {
  await openSignedIn(page, (route) => route.fulfill({ status: 503, json: { code: 'CATALOG_AUTH_UNAVAILABLE' } }));
  await expect(page.locator('#authContainer .user-name')).toContainText('ролята не е достъпна');
  await page.locator('#authContainer').getByRole('button', { name: 'Изход' }).click();
  await expect(page.locator('#authToggleBtn')).toBeVisible();
  expect(await page.evaluate(() => window.authRoleUnavailable)).toBe(false);
});

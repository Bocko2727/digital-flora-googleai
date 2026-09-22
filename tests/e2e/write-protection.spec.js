import { test, expect } from '@playwright/test';
import { mockCatalogApi } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await mockCatalogApi(page);
  await page.goto('/');
});

// This is the one spec that deliberately does NOT mock the /api/plants
// write endpoints - unlike every other spec, which mocks them per-test.
// Here the requests fall through to the real running node server.js (per
// mockCatalogApi's route.continue() for non-GET /api/plants), to prove the
// server itself enforces the auth boundary rather than trusting the client.
test.describe('unauthorized write protection', () => {
  test('POST /api/plants without auth returns 401', async ({ page }) => {
    const res = await page.request.post('/api/plants', {
      data: { commonName: 'X', latinName: 'Y', family: 'Z', photos: [] },
    });
    expect(res.status()).toBe(401);
    expect((await res.json()).code).toBe('UNAUTHENTICATED');
  });

  test('PUT /api/plants/:id without auth returns 401', async ({ page }) => {
    const res = await page.request.put('/api/plants/e2e-plant-1', {
      data: { commonName: 'X' },
    });
    expect(res.status()).toBe(401);
    expect((await res.json()).code).toBe('UNAUTHENTICATED');
  });

  test('DELETE /api/plants/:id without auth returns 401', async ({ page }) => {
    const res = await page.request.delete('/api/plants/e2e-plant-1');
    expect(res.status()).toBe(401);
    expect((await res.json()).code).toBe('UNAUTHENTICATED');
  });
});

test.describe('login/auth UI states', () => {
  test('auth panel opens and shows the login form', async ({ page }) => {
    await page.locator('#authToggleBtn').click();
    await expect(page.locator('#authPanel')).toHaveClass(/open/);
    await expect(page.locator('#auth_email')).toBeVisible();
    await expect(page.locator('#auth_password')).toBeVisible();
  });

  // Note: signInUser() checks `!supabaseClient` before the empty-field
  // check, and mockCatalogApi's /api/config stub always leaves
  // supabaseClient null - so the empty-field validation branch is
  // unreachable under this suite's established mocking approach (it would
  // require injecting a fake supabaseClient object, testing internal state
  // rather than a real user path). Not covered here for that reason.
  test('login with config nulled out (mockCatalogApi) shows "not configured" error', async ({ page }) => {
    await page.locator('#authToggleBtn').click();
    await page.locator('#auth_email').fill('test@example.com');
    await page.locator('#auth_password').fill('whatever123');
    await page.locator('#authPanel').getByRole('button', { name: 'Вход', exact: true }).click();
    await expect(page.locator('#authError')).toBeVisible();
    await expect(page.locator('#authError')).toHaveText('Supabase Auth не е конфигуриран.');
  });
});

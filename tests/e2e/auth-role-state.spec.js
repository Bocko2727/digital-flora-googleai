import { test, expect } from '@playwright/test';
import { openSignedIn, signedInUser as USER } from './helpers.js';

// Signed-in UI states without touching the real Supabase project; see
// openSignedIn in helpers.js. /api/auth/whoami is mocked per test.

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

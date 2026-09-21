import { test, expect } from '@playwright/test';
import { mockCatalogApi, plantsFixture } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await mockCatalogApi(page);
  await page.goto('/');
  await page.locator('.plant-card').first().click();
  await expect(page.locator('#modal')).toHaveClass(/open/);
});

// Note (product observation, not fixed here): the delete button is rendered
// unconditionally in the modal for every viewer, unlike #writeActions which
// is properly role-gated. Enforcement is purely server-side (DELETE requires
// role === 'admin' specifically, stricter than editor|admin for other
// writes). There's no role-gating UI behavior to test here for that reason.

test('delete: cancelling the confirm dialog aborts - no request fires, modal stays open', async ({ page }) => {
  let deleteRequestSeen = false;
  await page.route('**/api/plants/e2e-plant-1', (route) => {
    if (route.request().method() === 'DELETE') {
      deleteRequestSeen = true;
    }
    return route.continue();
  });

  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByTitle('Изтриване').click();

  await expect(page.locator('#modal')).toHaveClass(/open/);
  expect(deleteRequestSeen).toBe(false);
});

test('delete: confirming a successful delete closes the modal and shrinks the grid', async ({ page }) => {
  const remaining = plantsFixture.filter((p) => p.id !== 'e2e-plant-1');

  await page.route('**/api/plants/e2e-plant-1', (route) => {
    if (route.request().method() === 'DELETE') {
      return route.fulfill({ json: { success: true } });
    }
    return route.continue();
  });
  // deletePlant() calls loadPlants() on success, which re-fetches GET
  // /api/plants - override that route (last registration wins) to reflect
  // the post-delete state, or the deleted plant would reappear.
  await page.route('**/api/plants', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: remaining });
    }
    return route.continue();
  });

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTitle('Изтриване').click();

  await expect(page.locator('#modal')).not.toHaveClass(/open/);
  await expect(page.locator('.plant-card')).toHaveCount(remaining.length);
});

test('delete: a failed delete shows the alert with the server message, modal stays open', async ({ page }) => {
  await page.route('**/api/plants/e2e-plant-1', (route) => {
    if (route.request().method() === 'DELETE') {
      return route.fulfill({
        status: 403,
        json: { error: 'Нямате права за тази операция.', code: 'CATALOG_WRITE_FORBIDDEN' },
      });
    }
    return route.continue();
  });

  let alertMessage = '';
  // The confirm() and the failure alert() fire sequentially, not both up
  // front - register the second dialog handler from inside the first's
  // callback, after accept() resolves, so it can't accidentally catch the
  // confirm dialog instead.
  page.once('dialog', async (confirmDialog) => {
    expect(confirmDialog.type()).toBe('confirm');
    await confirmDialog.accept();
    page.once('dialog', async (alertDialog) => {
      expect(alertDialog.type()).toBe('alert');
      alertMessage = alertDialog.message();
      await alertDialog.accept();
    });
  });

  await page.getByTitle('Изтриване').click();
  await expect.poll(() => alertMessage).toContain('Нямате права за тази операция.');
  await expect(page.locator('#modal')).toHaveClass(/open/);
});

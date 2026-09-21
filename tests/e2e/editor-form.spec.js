import { test, expect } from '@playwright/test';
import { mockCatalogApi, plantsFixture } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await mockCatalogApi(page);
  await page.goto('/');
  await page.locator('.plant-card').first().click();
  await expect(page.locator('#modal')).toHaveClass(/open/);
  await page.getByTitle('Редакция').click();
});

test('editor form: pre-fills existing plant data', async ({ page }) => {
  const first = plantsFixture[0];
  await expect(page.locator('#e_cname')).toHaveValue(first.commonName);
  await expect(page.locator('#e_lname')).toHaveValue(first.latinName);
  await expect(page.locator('#e_fam')).toHaveValue(first.family);
});

test('editor form: saves an edit and reflects it in the view and grid', async ({ page }) => {
  const updatedName = 'Редактирано глухарче';

  await page.route('**/api/plants/e2e-plant-1', (route) => {
    if (route.request().method() === 'PUT') {
      return route.fulfill({ json: { ok: true } });
    }
    return route.continue();
  });

  await page.locator('#e_cname').fill(updatedName);
  await page.getByRole('button', { name: /Запази промените/ }).click();

  await expect(page.locator('.info h2')).toHaveText(updatedName);
  await expect(page.locator('.plant-card-title').first()).toHaveText(updatedName);
});

test('editor form: shows the server error on a failed save', async ({ page }) => {
  await page.route('**/api/plants/e2e-plant-1', (route) => {
    if (route.request().method() === 'PUT') {
      return route.fulfill({ status: 403, json: { error: 'Нямате права за тази операция.' } });
    }
    return route.continue();
  });

  let dialogMessage = '';
  page.once('dialog', async (dialog) => {
    dialogMessage = dialog.message();
    await dialog.accept();
  });

  await page.locator('#e_cname').fill('Опит без права');
  await page.getByRole('button', { name: /Запази промените/ }).click();
  await expect.poll(() => dialogMessage).toContain('Нямате права за тази операция.');
});

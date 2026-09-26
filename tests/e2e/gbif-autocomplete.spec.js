import { test, expect } from '@playwright/test';
import { mockCatalogApi } from './helpers.js';

const CANDIDATES = [
  { taxonKey: 123, scientificName: 'Ajuga reptans L.', canonicalName: 'Ajuga reptans', rank: 'SPECIES', status: 'ACCEPTED', family: 'Lamiaceae', kingdom: 'Plantae' },
];

test.beforeEach(async ({ page }) => {
  await mockCatalogApi(page);
  await page.goto('/');
  await page.locator('.plant-card').first().click();
  await expect(page.locator('#modal')).toHaveClass(/open/);
  await page.getByTitle('Редакция').click();
});

test('gbif autocomplete: shows suggestions and fills the form on pick, without saving', async ({ page }) => {
  let requestCount = 0;
  await page.route('**/api/gbif/search*', (route) => {
    requestCount++;
    return route.fulfill({ json: { candidates: CANDIDATES } });
  });

  await page.locator('#e_lname').fill('Ajuga rep');
  await expect(page.getByRole('button', { name: /Ajuga reptans/ })).toBeVisible();
  expect(requestCount).toBeGreaterThan(0);

  await page.getByRole('button', { name: /Ajuga reptans/ }).click();

  await expect(page.locator('#e_lname')).toHaveValue('Ajuga reptans');
  await expect(page.locator('#e_fam')).toHaveValue('Lamiaceae');
  await expect(page.locator('#e_tax')).toHaveValue('source-suggested');
  // Picking a suggestion only fills the form; it must not itself write to the server.
  await expect(page.locator('#gbif-suggest')).toContainText('запази ръчно');
});

test('gbif autocomplete: does not query GBIF for fewer than 3 characters', async ({ page }) => {
  let called = false;
  await page.route('**/api/gbif/search*', (route) => { called = true; return route.fulfill({ json: { candidates: [] } }); });

  await page.locator('#e_lname').fill('Aj');
  await page.waitForTimeout(500);
  expect(called).toBe(false);
});

test('gbif autocomplete: a GBIF failure shows a fallback note without blocking the form', async ({ page }) => {
  await page.route('**/api/gbif/search*', (route) => route.fulfill({ status: 502, json: { error: 'GBIF lookup is currently unavailable.' } }));

  await page.locator('#e_lname').fill('Ajuga rep');
  await expect(page.locator('#gbif-suggest')).toContainText('не е налично');
  // The rest of the form remains usable.
  await expect(page.getByRole('button', { name: /Запази промените/ })).toBeEnabled();
});

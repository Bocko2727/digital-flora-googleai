import { test, expect } from '@playwright/test';
import { mockCatalogApi, plantsFixture } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await mockCatalogApi(page);
  await page.goto('/');
});

test('catalog load: renders a card for every fixture plant', async ({ page }) => {
  await expect(page.locator('.plant-card')).toHaveCount(plantsFixture.length);
  await expect(page.locator('#counterText')).toContainText(String(plantsFixture.length));
});

test('search: filters by Bulgarian common name', async ({ page }) => {
  await page.locator('#searchInput').fill('глухарче');
  await expect(page.locator('.plant-card')).toHaveCount(1);
  await expect(page.locator('.plant-card-title')).toContainText('глухарче', { ignoreCase: true });
});

test('search: filters by Latin name', async ({ page }) => {
  await page.locator('#searchInput').fill('Papaver');
  await expect(page.locator('.plant-card')).toHaveCount(1);
  await expect(page.locator('.plant-card-latin')).toContainText('Papaver rhoeas');
});

test('family filter: narrows results to the selected family', async ({ page }) => {
  await page.locator('#familyFilter').selectOption({ label: 'Papaveraceae' });
  await expect(page.locator('.plant-card')).toHaveCount(1);
});

test('search: no matches shows the empty-state message', async ({ page }) => {
  await page.locator('#searchInput').fill('несъществуващо растение xyz');
  await expect(page.locator('#grid')).toContainText('Няма намерени растения');
});

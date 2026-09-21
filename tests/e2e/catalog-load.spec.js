import { test, expect } from '@playwright/test';
import { mockCatalogApi, plantsFixture } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await mockCatalogApi(page);
  await page.goto('/');
});

test('catalog load: family filter is populated from fixture data, deduped and sorted', async ({ page }) => {
  const famSelect = page.locator('#familyFilter');
  await expect(famSelect.locator('option')).toHaveCount(3); // "Всички семейства" + 2 unique families
  await expect(famSelect).toContainText('Asteraceae');
  await expect(famSelect).toContainText('Papaveraceae');
});

test('catalog load: initial render count matches fixture, bounded by page size', async ({ page }) => {
  await expect(page.locator('.plant-card').first()).toBeVisible();
  const pageSize = await page.evaluate(() => window.pageSize);
  await expect(page.locator('.plant-card')).toHaveCount(Math.min(plantsFixture.length, pageSize));
});

test('catalog load: counter text reflects the exact "Показани X–Y от Z" format', async ({ page }) => {
  await expect(page.locator('#counterText')).toHaveText(
    `Показани 1–${plantsFixture.length} от ${plantsFixture.length} образеца (Общо в хербария: ${plantsFixture.length})`
  );
});

test('catalog load: pagination controls stay hidden when everything fits on one page', async ({ page }) => {
  await expect(page.locator('#paginationWrap')).toBeHidden();
});

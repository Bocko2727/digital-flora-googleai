import { test, expect } from '@playwright/test';
import { mockCatalogApi, plantsPaginatedFixture } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await mockCatalogApi(page, { plants: plantsPaginatedFixture });
  await page.goto('/');
  await expect(page.locator('.plant-card').first()).toBeVisible();
});

const TOTAL = 25;

test('pagination: controls appear and first page shows 12 items at the default page size', async ({ page }) => {
  await expect(page.locator('#paginationWrap')).toBeVisible();
  await expect(page.locator('.plant-card')).toHaveCount(12);
  await expect(page.locator('#counterText')).toHaveText(
    `Показани 1–12 от ${TOTAL} образеца (Общо в хербария: ${TOTAL})`
  );
  await expect(page.locator('#prevPageBtn')).toBeDisabled();
  await expect(page.locator('#nextPageBtn')).toBeEnabled();
});

test('pagination: next button navigates to page 2 and updates grid + counter', async ({ page }) => {
  await page.locator('#nextPageBtn').click();
  await expect(page.locator('.plant-card')).toHaveCount(12);
  await expect(page.locator('#counterText')).toHaveText(
    `Показани 13–24 от ${TOTAL} образеца (Общо в хербария: ${TOTAL})`
  );
  await expect(page.locator('#prevPageBtn')).toBeEnabled();
});

test('pagination: last page shows the partial remainder and disables next', async ({ page }) => {
  await page.locator('#pageNumbers .page-num', { hasText: '3' }).click();
  await expect(page.locator('.plant-card')).toHaveCount(1);
  await expect(page.locator('#counterText')).toHaveText(
    `Показани 25–25 от ${TOTAL} образеца (Общо в хербария: ${TOTAL})`
  );
  await expect(page.locator('#nextPageBtn')).toBeDisabled();
});

test('pagination: changing page size to 24 shows more items and resets to page 1', async ({ page }) => {
  await page.locator('#nextPageBtn').click(); // go to page 2 first
  await page.selectOption('#pageSizeSelect', '24');

  await expect(page.locator('.plant-card')).toHaveCount(24);
  await expect(page.locator('#counterText')).toHaveText(
    `Показани 1–24 от ${TOTAL} образеца (Общо в хербария: ${TOTAL})`
  );
  await expect(page.evaluate(() => localStorage.getItem('pageSize'))).resolves.toBe('24');
});

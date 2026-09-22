import { test, expect } from '@playwright/test';
import { mockCatalogApi } from './helpers.js';

// A custom mobile profile (rather than devices['iPhone 12']) so this stays on
// the installed Chromium engine instead of pulling in WebKit.
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
});

test.beforeEach(async ({ page }) => {
  await mockCatalogApi(page);
  await page.goto('/');
});

test('mobile viewport: catalog renders without horizontal overflow', async ({ page }) => {
  await expect(page.locator('.plant-card').first()).toBeVisible();

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
});

test('mobile viewport: search input is visible and usable', async ({ page }) => {
  const search = page.locator('#searchInput');
  await expect(search).toBeVisible();
  await search.fill('мак');
  await expect(page.locator('.plant-card')).toHaveCount(1);
});

test('mobile viewport: tapping a card opens the detail modal', async ({ page }) => {
  await page.locator('.plant-card').first().click();
  await expect(page.locator('#modal')).toHaveClass(/open/);
  await expect(page.locator('.info h2')).toBeVisible();
});

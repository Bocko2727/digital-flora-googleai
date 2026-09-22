import { test, expect } from '@playwright/test';
import { mockCatalogApi } from './helpers.js';

// Phase 4.2 visual regression: 4 stable, low-churn screens covering the P0
// surfaces from CLAUDE.md (catalog display, detail view, mobile, editing).
// Uses the small static 3-item fixture so content never varies between runs.
//
// Baseline PNGs are intentionally NOT committed from local development - see
// the CI proposal. Font/anti-aliasing rendering differs between a local
// sandbox and the actual GitHub Actions runner, so baselines must be
// generated on the real CI environment to avoid false failures on the very
// first comparison run. A small maxDiffPixelRatio tolerance absorbs the
// unavoidable minor anti-aliasing noise between otherwise-identical runs.
const SCREENSHOT_OPTS = { maxDiffPixelRatio: 0.02, animations: 'disabled' };

test('screenshot: catalog grid (desktop)', async ({ page }) => {
  await mockCatalogApi(page);
  await page.goto('/');
  await expect(page.locator('.plant-card').first()).toBeVisible();
  await expect(page).toHaveScreenshot('catalog-grid-desktop.png', SCREENSHOT_OPTS);
});

test('screenshot: plant detail modal', async ({ page }) => {
  await mockCatalogApi(page);
  await page.goto('/');
  await page.locator('.plant-card').first().click();
  await expect(page.locator('#modal')).toHaveClass(/open/);
  await expect(page.locator('.info h2')).toBeVisible();
  await expect(page).toHaveScreenshot('plant-detail-modal.png', SCREENSHOT_OPTS);
});

test('screenshot: mobile catalog view', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockCatalogApi(page);
  await page.goto('/');
  await expect(page.locator('.plant-card').first()).toBeVisible();
  await expect(page).toHaveScreenshot('mobile-catalog.png', SCREENSHOT_OPTS);
});

test('screenshot: editor form modal', async ({ page }) => {
  await mockCatalogApi(page);
  await page.goto('/');
  await page.locator('.plant-card').first().click();
  await expect(page.locator('#modal')).toHaveClass(/open/);
  await page.getByTitle('Редакция').click();
  await expect(page.locator('#e_cname')).toBeVisible();
  await expect(page).toHaveScreenshot('editor-form-modal.png', SCREENSHOT_OPTS);
});

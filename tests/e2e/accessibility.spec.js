import { test, expect } from '@playwright/test';
import { mockCatalogApi, plantsFixture, plantsPaginatedFixture } from './helpers.js';

// WCAG 2.2 AA regression guards for the fixes in docs/ACCESSIBILITY.md.
// No extra dependencies: plain Playwright role queries plus a small WCAG
// contrast helper evaluated in the page.

async function contrastOf(page, selector) {
  return page.locator(selector).first().evaluate((el) => {
    const parse = (c) => (c.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    // First ancestor (or self) with an opaque background.
    let bgEl = el;
    let bg = [255, 255, 255, 1];
    while (bgEl) {
      const c = parse(getComputedStyle(bgEl).backgroundColor);
      if (c.length === 3 || (c.length === 4 && c[3] === 1)) { bg = c; break; }
      bgEl = bgEl.parentElement;
    }
    const fg = parse(getComputedStyle(el).color);
    const a = lum(fg), b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
}

test.describe('accessibility', () => {
  test('skip link is the first Tab stop and targets the catalog', async ({ page }) => {
    await mockCatalogApi(page);
    await page.goto('/');
    await expect(page.locator('.plant-card').first()).toBeVisible();
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Към каталога' });
    await expect(skip).toBeFocused();
    await expect(skip).toHaveAttribute('href', '#main');
  });

  test('search and filter controls have accessible names', async ({ page }) => {
    await mockCatalogApi(page);
    await page.goto('/');
    await expect(page.getByRole('search', { name: 'Търсене и филтри' })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: /Търсене/ })).toBeVisible();
    for (const name of ['Семейство', 'Статус на разпознаването', 'Подреждане', 'Растения на страница']) {
      await expect(page.getByRole('combobox', { name })).toBeVisible();
    }
  });

  test('a plant card opens by keyboard, traps focus and returns it on Escape', async ({ page }) => {
    await mockCatalogApi(page);
    await page.goto('/');
    const name = plantsFixture[0].commonName;
    const cardButton = page.getByRole('button', { name, exact: true });
    await cardButton.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog', { name });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'Затвори' }).first()).toBeFocused();

    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.getElementById('modal').contains(document.activeElement))).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(page.locator('#modal')).not.toHaveClass(/open/);
    await expect(cardButton).toBeFocused();
  });

  test('auth dialog fields are labelled and focus starts in the form', async ({ page }) => {
    await mockCatalogApi(page);
    await page.goto('/');
    await page.locator('#authToggleBtn').click();
    await expect(page.getByRole('dialog', { name: 'Вход за редактори' })).toBeVisible();
    await expect(page.getByLabel('Имейл')).toBeFocused();
    await expect(page.getByLabel('Парола')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#authPanel')).not.toHaveClass(/open/);
  });

  test('view toggle exposes its state and pagination marks the current page', async ({ page }) => {
    await mockCatalogApi(page, { plants: plantsPaginatedFixture });
    await page.goto('/');
    await page.getByRole('button', { name: 'Списък' }).click();
    await expect(page.getByRole('button', { name: 'Списък' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Голям' })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('navigation', { name: 'Страници' }).locator('[aria-current="page"]')).toHaveText('1');
  });

  for (const theme of ['light', 'dark']) {
    test(`text contrast meets 4.5:1 in the ${theme} theme`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
      // No colour transitions mid-measurement (the CSS honours reduced motion).
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await mockCatalogApi(page);
      await page.goto('/');
      await expect(page.locator('.plant-card').first()).toBeVisible();
      for (const sel of [
        '.header-text p',
        '#viewToggle button.active',
        '.drive-btn',
        '.plant-card-title',
        '.plant-card-latin',
        '.plant-card-meta',
        '.plant-card .badge',
        '.stats-bar',
      ]) {
        expect(await contrastOf(page, sel), `${theme}: ${sel}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  test('sticky toolbar leaves most of a 320px-wide phone screen free', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await mockCatalogApi(page);
    await page.goto('/');
    await expect(page.locator('.plant-card').first()).toBeVisible();
    const h = await page.locator('.controls').evaluate((el) => el.getBoundingClientRect().height);
    expect(h).toBeLessThan(640 * 0.5);
  });
});

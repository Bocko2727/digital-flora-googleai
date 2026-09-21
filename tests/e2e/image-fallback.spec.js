import { test, expect } from '@playwright/test';
import { mockCatalogApi } from './helpers.js';

// resolvePhotoUrl() only leaves a photo value untouched when it's already an
// https:// URL or a data: URI — any other value (even a leading-slash local
// path) gets rewritten into a production Supabase Storage URL as a "legacy
// bare filename". So the broken-photo fixture must use a full https:// URL
// to reliably trigger the img onerror fallback via a mocked network failure.
const brokenPhotoPlant = {
  id: 'e2e-broken-photo',
  commonName: 'Счупена снимка',
  latinName: 'Testus brokenus',
  family: 'Testaceae',
  photos: ['https://example.com/broken-nonexistent-image.jpg'],
  confidence: 'Потвърдено',
  recognition: '-',
  habitat: '-',
  lookalikes: '-',
  benefits: '-',
  risks: '-',
  uses: '-',
  funFact: '-'
};

const noPhotoPlant = {
  ...brokenPhotoPlant,
  id: 'e2e-no-photo',
  commonName: 'Без снимка',
  photos: []
};

// resolvePhotoUrl() appends "?cb=1" to a bare https:// URL, so the mocked
// route must match with an optional query string.
const BROKEN_PHOTO_ROUTE = 'https://example.com/broken-nonexistent-image.jpg*';

test('image fallback: broken card image falls back to /icon.svg via onerror', async ({ page }) => {
  await page.route(BROKEN_PHOTO_ROUTE, (route) => route.fulfill({ status: 404, body: '' }));
  await mockCatalogApi(page, { plants: [brokenPhotoPlant] });
  await page.goto('/');
  await expect(page.locator('.plant-card-img').first()).toHaveAttribute('src', '/icon.svg');
});

test('image fallback: broken modal image falls back to /icon.svg via onerror', async ({ page }) => {
  await page.route(BROKEN_PHOTO_ROUTE, (route) => route.fulfill({ status: 404, body: '' }));
  await mockCatalogApi(page, { plants: [brokenPhotoPlant] });
  await page.goto('/');
  await page.locator('.plant-card').first().click();
  await expect(page.locator('#modal')).toHaveClass(/open/);
  await expect(page.locator('.photo-wrap img.photo')).toHaveAttribute('src', '/icon.svg');
});

test('image fallback: a plant with no photos renders /icon.svg directly', async ({ page }) => {
  await mockCatalogApi(page, { plants: [noPhotoPlant] });
  await page.goto('/');
  await expect(page.locator('.plant-card-img').first()).toHaveAttribute('src', '/icon.svg');
});

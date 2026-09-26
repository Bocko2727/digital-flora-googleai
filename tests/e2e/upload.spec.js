import { test, expect } from '@playwright/test';
import { mockCatalogApi, plantsFixture } from './helpers.js';

// A real, tiny (2x2) Chromium-encoded JPEG so the client's in-browser canvas
// re-encode (readFileAsResizedDataUri, index.html) succeeds and the upload
// actually reaches the network layer, instead of failing client-side on
// img.onerror for garbage bytes.
const TINY_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABgj/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABykX//Z';
const TINY_JPEG_BUFFER = Buffer.from(TINY_JPEG_BASE64, 'base64');

test.beforeEach(async ({ page }) => {
  await mockCatalogApi(page);
  await page.goto('/');
  await page.locator('.plant-card').first().click();
  await expect(page.locator('#modal')).toHaveClass(/open/);
  await page.getByTitle('Редакция').click();
});

// Note: uploadPlantPhotos() unconditionally calls editPlant() at the end of
// every run (success or failure), which replaces #view's whole innerHTML and
// wipes #photoUploadStatus's message with it in the same synchronous flow -
// so the status text is never actually observable (0ms visibility before
// being wiped). That's a real product UX inconsistency, not a test-timing
// issue - flagged separately, not fixed here. These tests assert stable,
// post-render state instead (network calls made / not made, photo count).

test('upload: oversized file is rejected client-side before any network call', async ({ page }) => {
  let writeRequestSeen = false;
  await page.route('**/api/plants/e2e-plant-1/photos', (route) => {
    writeRequestSeen = true;
    return route.fulfill({ status: 500, json: { error: 'should not be called' } });
  });

  await page.setInputFiles('#e_photo_input', {
    name: 'too-big.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.alloc(6 * 1024 * 1024),
  });

  await expect(page.getByText(`Снимки (${plantsFixture[0].photos.length} качени)`)).toBeVisible();
  expect(writeRequestSeen).toBe(false);
});

test('upload: server rejects an invalid image with 400 INVALID_IMAGE, photo count stays unchanged', async ({ page }) => {
  let writeRequestSeen = false;
  await page.route('**/api/plants/e2e-plant-1/photos', (route) => {
    if (route.request().method() === 'POST') {
      writeRequestSeen = true;
      return route.fulfill({ status: 400, json: { error: 'Invalid image data.', code: 'INVALID_IMAGE' } });
    }
    return route.continue();
  });

  // Wait for the POST itself: the photo-count text below is already on screen
  // before the upload starts, so it cannot prove the request was made.
  const uploadRequest = page.waitForRequest(
    (req) => req.url().includes('/api/plants/e2e-plant-1/photos') && req.method() === 'POST'
  );
  await page.setInputFiles('#e_photo_input', {
    name: 'valid-but-rejected.jpg',
    mimeType: 'image/jpeg',
    buffer: TINY_JPEG_BUFFER,
  });
  await uploadRequest;

  await expect(page.getByText(`Снимки (${plantsFixture[0].photos.length} качени)`)).toBeVisible();
  expect(writeRequestSeen).toBe(true);
});

test('upload: a valid photo uploads successfully and the edit form reflects the new photo count', async ({ page }) => {
  const updatedPlant = { ...plantsFixture[0], photos: [...plantsFixture[0].photos, 'https://example.com/new-photo.jpg'] };

  await page.route('**/api/plants/e2e-plant-1/photos', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        json: { success: true, imageUrl: 'https://example.com/new-photo.jpg', plant: updatedPlant },
      });
    }
    return route.continue();
  });

  await page.setInputFiles('#e_photo_input', {
    name: 'valid.jpg',
    mimeType: 'image/jpeg',
    buffer: TINY_JPEG_BUFFER,
  });

  await expect(page.getByText(`Снимки (${updatedPlant.photos.length} качени)`)).toBeVisible();
});

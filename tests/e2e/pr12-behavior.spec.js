import { test, expect } from '@playwright/test';
import { mockCatalogApi, plantsFixture } from './helpers.js';

// Behaviour introduced by PR #12 (catalog source notice, AI-labelled
// confidence, honest empty-field fallbacks, visible upload failures, editor
// not saving display fallbacks back). Every backend call is mocked with
// page.route - nothing reaches Supabase or the AI provider.

// Same real 2x2 JPEG as upload.spec.js, so the in-browser canvas re-encode in
// resizeImageForAiUpload() succeeds and the flow reaches the network layer.
const TINY_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABgj/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABykX//Z';
const TINY_JPEG_BUFFER = Buffer.from(TINY_JPEG_BASE64, 'base64');

const AI_CONFIDENCE = 'Вероятно (AI 92%)';
const RISKS_FALLBACK = 'Няма данни — рисковете не са проверени.';

// A single AI-suggested plant with no risk data, so it is the only card and
// opens at index 0.
const aiPlant = {
  id: 'e2e-ai-plant',
  commonName: 'Горска ягода',
  latinName: 'Fragaria vesca',
  family: 'Rosaceae (Розоцветни)',
  photos: ['/icon.svg'],
  confidence: AI_CONFIDENCE,
  recognition: 'Тройни листа, бели цветове.',
  habitat: 'Горски поляни.',
  lookalikes: '-',
  benefits: '-',
  risks: '',
  uses: '-',
  funFact: '-',
};

// Serves GET /api/plants with an optional X-Catalog-Source header. Registered
// after mockCatalogApi so it takes precedence for GET requests.
async function routePlantsWithSource(page, source, plants = plantsFixture) {
  await page.route('**/api/plants', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const headers = { 'Content-Type': 'application/json' };
    if (source) headers['X-Catalog-Source'] = source;
    return route.fulfill({ status: 200, headers, body: JSON.stringify(plants) });
  });
}

test.describe('catalog source notice', () => {
  test('archive-fallback header shows the read-only archive notice', async ({ page }) => {
    await mockCatalogApi(page);
    await routePlantsWithSource(page, 'archive-fallback');
    await page.goto('/');
    await expect(page.locator('.plant-card')).toHaveCount(plantsFixture.length);

    const notice = page.locator('#catalogSourceNotice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('архивно AI копие');
  });

  test('supabase header does not show the notice', async ({ page }) => {
    await mockCatalogApi(page);
    await routePlantsWithSource(page, 'supabase');
    await page.goto('/');
    await expect(page.locator('.plant-card')).toHaveCount(plantsFixture.length);
    await expect(page.locator('#catalogSourceNotice')).toHaveCount(0);
  });

  test('missing header does not show the notice', async ({ page }) => {
    await mockCatalogApi(page);
    await routePlantsWithSource(page, null);
    await page.goto('/');
    await expect(page.locator('.plant-card')).toHaveCount(plantsFixture.length);
    await expect(page.locator('#catalogSourceNotice')).toHaveCount(0);
  });
});

test.describe('AI-labelled plant display', () => {
  test.beforeEach(async ({ page }) => {
    await mockCatalogApi(page, { plants: [aiPlant] });
    await page.goto('/');
    await expect(page.locator('.plant-card')).toHaveCount(1);
  });

  test('AI confidence label is shown as-is and never as "Потвърдено"', async ({ page }) => {
    const cardBadge = page.locator('.plant-card .plant-card-footer span');
    await expect(cardBadge).toHaveText(AI_CONFIDENCE);
    await expect(cardBadge).not.toContainText('Потвърдено');

    await page.locator('.plant-card').first().click();
    await expect(page.locator('#modal')).toHaveClass(/open/);
    const modalBadge = page.locator('#view .info > span[class*="badge"]');
    await expect(modalBadge).toHaveText(AI_CONFIDENCE);
    await expect(modalBadge).not.toContainText('Потвърдено');
    // sc() maps non-"Потвърдено" statuses to the "probable" badge style.
    await expect(modalBadge).toHaveClass(/prob/);
  });

  test('empty risks shows the "not verified" fallback under the risks heading', async ({ page }) => {
    await page.locator('.plant-card').first().click();
    await expect(page.locator('#modal')).toHaveClass(/open/);
    const risksParagraph = page
      .locator('#view h3', { hasText: 'Вреди и рискове (токсичност)' })
      .locator('xpath=following-sibling::p[1]');
    await expect(risksParagraph).toHaveText(RISKS_FALLBACK);
  });

  test('saving an unchanged edit sends the raw confidence and empty risks, not display fallbacks', async ({ page }) => {
    let putBody = null;
    await page.route(`**/api/plants/${aiPlant.id}`, (route) => {
      if (route.request().method() === 'PUT') {
        putBody = route.request().postDataJSON();
        return route.fulfill({ json: { ok: true } });
      }
      return route.fallback();
    });

    await page.locator('.plant-card').first().click();
    await expect(page.locator('#modal')).toHaveClass(/open/);
    const displayedConfidence = await page.locator('#view .info > span[class*="badge"]').innerText();
    await page.getByTitle('Редакция').click();
    await expect(page.locator('#e_conf')).toHaveValue(AI_CONFIDENCE);
    await expect(page.locator('#e_risk')).toHaveValue('');

    await page.getByRole('button', { name: /Запази промените/ }).click();
    await expect.poll(() => putBody).not.toBeNull();

    expect(putBody.confidence).toBe(displayedConfidence);
    expect(putBody.confidence).toBe(AI_CONFIDENCE);
    expect(putBody.risks).toBe('');
    expect(putBody.risks).not.toContain('Няма данни');
  });
});

test.describe('AI upload flow status', () => {
  test.beforeEach(async ({ page }) => {
    await mockCatalogApi(page);
  });

  test('photo storage failure (502) reports the plant as added without a photo', async ({ page }) => {
    const newId = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';
    const calls = { upload: 0, create: 0, photo: 0 };

    await page.route('**/api/upload', (route) => {
      calls.upload += 1;
      return route.fulfill({
        status: 200,
        json: {
          record: {
            likely_common_name_bg: 'Тестово растение',
            likely_scientific_name: 'Testus plantus',
            family: 'Testaceae',
            confidence: 0.92,
          },
        },
      });
    });
    await page.route('**/api/plants', (route) => {
      if (route.request().method() === 'POST') {
        calls.create += 1;
        return route.fulfill({ status: 201, json: { plant: { id: newId } } });
      }
      return route.fallback();
    });
    await page.route(`**/api/plants/${newId}/photos`, (route) => {
      calls.photo += 1;
      return route.fulfill({ status: 502, json: { error: 'Storage upload failed.' } });
    });

    await page.goto('/');
    await expect(page.locator('.plant-card')).toHaveCount(plantsFixture.length);
    await page.setInputFiles('#uploadInput', {
      name: 'nophoto.jpg',
      mimeType: 'image/jpeg',
      buffer: TINY_JPEG_BUFFER,
    });

    const status = page.locator('#uploadStatus');
    await expect(status).toContainText('Добавени без снимка');
    await expect(status).toContainText('nophoto.jpg');
    await expect(status).toBeVisible();
    expect(calls).toEqual({ upload: 1, create: 1, photo: 1 });
  });

  test('anonymous upload (401) is reported as unsuccessful and creates nothing', async ({ page }) => {
    let createCalled = false;
    await page.route('**/api/upload', (route) =>
      route.fulfill({ status: 401, json: { error: 'Authentication is required.' } })
    );
    await page.route('**/api/plants', (route) => {
      if (route.request().method() === 'POST') {
        createCalled = true;
        return route.fulfill({ status: 500, json: { error: 'should not be called' } });
      }
      return route.fallback();
    });

    await page.goto('/');
    await expect(page.locator('.plant-card')).toHaveCount(plantsFixture.length);
    await page.setInputFiles('#uploadInput', {
      name: 'anon.jpg',
      mimeType: 'image/jpeg',
      buffer: TINY_JPEG_BUFFER,
    });

    const status = page.locator('#uploadStatus');
    await expect(status).toContainText('Неуспешни: anon.jpg');
    await expect(status).toContainText('Обработени 0 от 1');
    await expect(status).toBeVisible();
    expect(createCalled).toBe(false);
  });
});

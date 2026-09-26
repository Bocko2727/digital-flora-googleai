import { test, expect } from '@playwright/test';
import { mockCatalogApi, plantsFixture } from './helpers.js';

// AI-sourced records (single-upload "AI x%" or the AI-generated botanical
// archive) must label their botanical text as unverified; editor-confirmed
// records must not (CLAUDE.md §4.13/§4.14).
const base = plantsFixture[0];
const plants = [
  { ...base, id: 'ai-upload', commonName: 'AI качване', confidence: 'Вероятно (AI 92%)' },
  { ...base, id: 'ai-archive', commonName: 'AI архив', confidence: 'Вероятно (Ботанически архив, AI)' },
  { ...base, id: 'ai-vision', commonName: 'Vision запис', confidence: 'Вероятно (Vision анализ)' },
  { ...base, id: 'editor-confirmed', commonName: 'Потвърден запис', confidence: 'Потвърдено' },
];

async function openByName(page, name) {
  await page.locator('.plant-card', { hasText: name }).click();
  await expect(page.locator('#modal')).toHaveClass(/open/);
}

test.beforeEach(async ({ page }) => {
  await mockCatalogApi(page, { plants });
  await page.goto('/');
  await expect(page.locator('.plant-card')).toHaveCount(plants.length);
});

for (const name of ['AI качване', 'AI архив', 'Vision запис']) {
  test(`AI text label: shown on every botanical section for "${name}"`, async ({ page }) => {
    await openByName(page, name);
    const marks = page.locator('#view .ai-text-mark');
    await expect(marks).toHaveCount(5);
    await expect(marks.first()).toHaveText('AI текст — непроверен');
    await expect(page.locator('#view h3', { hasText: 'Вреди и рискове' }).locator('.ai-text-mark')).toBeVisible();
  });
}

test('AI text label: absent on an editor-confirmed record', async ({ page }) => {
  await openByName(page, 'Потвърден запис');
  await expect(page.locator('#view h3').first()).toBeVisible();
  await expect(page.locator('#view .ai-text-mark')).toHaveCount(0);
});

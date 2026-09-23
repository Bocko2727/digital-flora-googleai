import { test, expect } from '@playwright/test';
import { mockCatalogApi, plantsFixture } from './helpers.js';

const plant = { ...plantsFixture[0], id: '11111111-1111-4111-8111-111111111111', taxonomyStatus: 'needs-review' };

test('taxonomy status: modal shows the label and the editor sends the chosen status', async ({ page }) => {
  await mockCatalogApi(page, { plants: [plant] });
  let putBody = null;
  await page.route(`**/api/plants/${plant.id}`, async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    putBody = route.request().postDataJSON();
    return route.fulfill({ json: { success: true, plant: { id: plant.id } } });
  });
  await page.goto('/');
  await page.locator('.plant-card').first().click();
  await expect(page.locator('#view .meta')).toContainText('За преглед');

  await page.getByTitle('Редакция').click();
  const select = page.locator('#e_tax');
  await expect(select).toHaveValue('needs-review');
  await select.selectOption('editor-confirmed');
  await page.getByRole('button', { name: /Запази/ }).click();

  await expect.poll(() => putBody && putBody.taxonomyStatus).toBe('editor-confirmed');
  await expect(page.locator('#view .meta')).toContainText('Потвърдено от редактор');
});

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const plantsFixture = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures', 'plants.json'), 'utf8')
);

// 25 items - more than either #pageSizeSelect option (12/24) - for exercising
// multi-page pagination state, which the default 3-item fixture can't.
export const plantsPaginatedFixture = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures', 'plants-paginated.json'), 'utf8')
);

// Intercepts all Supabase/backend calls the catalog page makes so tests never
// touch the real Supabase project (data safety: CLAUDE.md §7 forbids writing
// test data to production Supabase). GET /api/plants serves the fixture;
// /api/config is neutered so the real Supabase Auth SDK never initializes.
export async function mockCatalogApi(page, { plants = plantsFixture } = {}) {
  await page.route('**/api/config', (route) =>
    route.fulfill({ json: { supabaseUrl: null, supabasePublishableKey: null } })
  );
  await page.route('**/api/plants', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: plants });
    }
    return route.continue();
  });
}

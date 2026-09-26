import test from 'node:test';
import assert from 'node:assert/strict';

// No direct Postgres pool in these tests: getSupabasePlants() must fall
// through to the read-only Data API path. Set before the dynamic import,
// because src/db/supabase.js creates the pool at import time.
delete process.env.SUPABASE_DB_URL;
const { getSupabasePlants, getPlantsViaRest } = await import('../src/db/plants.js');

const originalFetch = globalThis.fetch;
const originalEnv = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_PUBLISHABLE_KEY };

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreEnv('SUPABASE_URL', originalEnv.url);
  restoreEnv('SUPABASE_PUBLISHABLE_KEY', originalEnv.key);
});

function mockFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return handler(url, options);
  };
  return calls;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('reads the live catalog through the Data API with the publishable key', async () => {
  process.env.SUPABASE_URL = 'https://example.supabase.co/';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  const calls = mockFetch(() => jsonResponse([
    {
      id: '6ee821e7-f631-42d7-9a36-00a425c7a422', common_name: 'Подъбиче?', latin_name: 'cf. Teucrium sp.',
      family: null, photos: ['IMG_5512.jpg'], confidence: '0.3', risks: 'text', taxonomy_status: 'needs-review',
      created_at: '2026-09-23T10:00:00Z',
    },
    { id: 'b', common_name: null, latin_name: null, photos: [], confidence: 'high', taxonomy_status: null },
  ]));

  const plants = await getSupabasePlants();

  assert.equal(calls.length, 1);
  const url = new URL(calls[0].url);
  assert.equal(url.origin + url.pathname, 'https://example.supabase.co/rest/v1/plants');
  assert.equal(url.searchParams.get('order'), 'created_at.desc');
  assert.ok(url.searchParams.get('select').split(',').includes('taxonomy_status'));
  assert.equal(calls[0].options.headers.apikey, 'sb_publishable_test');
  assert.equal(calls[0].options.method, undefined, 'must be a plain GET');

  assert.equal(plants.length, 2);
  assert.deepEqual(plants[0], {
    id: '6ee821e7-f631-42d7-9a36-00a425c7a422', commonName: 'Подъбиче?', latinName: 'cf. Teucrium sp.',
    family: '', photos: ['IMG_5512.jpg'], confidence: 'Неопределимо (AI 30%)', recognition: '', habitat: '',
    lookalikes: '', benefits: '', risks: 'text', uses: '', funFact: '', authorEmail: '',
    taxonomyStatus: 'needs-review', createdAt: '2026-09-23T10:00:00Z',
  });
  assert.equal(plants[1].commonName, 'Неопределено растение');
  assert.deepEqual(plants[1].photos, ['placeholder.jpg']);
  assert.equal(plants[1].taxonomyStatus, 'manual-unverified');
});

test('returns null (archive fallback) when the Data API fails', async () => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  const originalError = console.error;
  console.error = () => {};
  try {
    mockFetch(() => jsonResponse({ message: 'nope' }, 401));
    assert.equal(await getPlantsViaRest(), null);
    mockFetch(() => { throw new Error('network down'); });
    assert.equal(await getPlantsViaRest(), null);
    mockFetch(() => jsonResponse({ not: 'an array' }));
    assert.equal(await getPlantsViaRest(), null);
  } finally {
    console.error = originalError;
  }
});

test('does not call the Data API without SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY', async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  const calls = mockFetch(() => jsonResponse([]));
  assert.equal(await getSupabasePlants(), null);
  assert.equal(calls.length, 0);
});

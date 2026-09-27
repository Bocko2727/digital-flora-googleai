import test from 'node:test';
import assert from 'node:assert/strict';
import { useSupabaseEnv } from './support/isolated-supabase-env.js';

// No SUPABASE_DB_URL: there is no Postgres pool, so every catalog operation
// must use the Data API. All network calls go to a mocked fetch.
const { apiKeyHeaders } = await import('../src/db/supabase-rest.js');
const catalog = await import('../src/db/supabase-catalog.js');

const PLANT_ID = '6ee821e7-f631-42d7-9a36-00a425c7a422';
const EDITOR = { id: 'b3c7a0de-5a4f-4a9c-8f7e-2d1c9e0f1a2b', email: 'editor@example.com', role: 'editor', accessToken: 'user-access-token' };
const SERVICE_JWT = 'eyJhbGciOiJIUzI1NiJ9.test-service-role.signature';
const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(...responses) {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: new URL(url), options, body: options.body === undefined ? undefined : JSON.parse(options.body) });
    const next = responses.length > 1 ? responses.shift() : responses[0];
    return typeof next === 'function' ? next(url, options) : next;
  };
  return calls;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function serviceEnv(serviceKey = SERVICE_JWT) {
  useSupabaseEnv({ SUPABASE_URL: 'https://example.supabase.co/', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', SUPABASE_SERVICE_ROLE_KEY: serviceKey });
}

test('opaque sb_ keys go only in apikey; legacy JWT keys are also the bearer token', () => {
  assert.deepEqual(apiKeyHeaders('sb_secret_test'), { apikey: 'sb_secret_test' });
  assert.deepEqual(apiKeyHeaders(SERVICE_JWT), { apikey: SERVICE_JWT, authorization: `Bearer ${SERVICE_JWT}` });
});

test('insert goes through the Data API with the service key and the same row values', async () => {
  serviceEnv();
  const calls = mockFetch(json([{ id: PLANT_ID }], 201));

  const created = await catalog.insertSupabasePlant({ commonName: ' Червен мак ', latinName: 'Papaver rhoeas', photos: [' a.jpg '], family: '' }, EDITOR);

  assert.deepEqual(created, { id: PLANT_ID });
  assert.equal(calls.length, 1);
  const [call] = calls;
  assert.equal(call.url.origin + call.url.pathname, 'https://example.supabase.co/rest/v1/plants');
  assert.equal(call.url.searchParams.get('select'), 'id');
  assert.equal(call.options.method, 'POST');
  assert.equal(call.options.headers.apikey, SERVICE_JWT);
  assert.equal(call.options.headers.authorization, `Bearer ${SERVICE_JWT}`);
  assert.equal(call.options.headers.prefer, 'return=representation');
  assert.deepEqual(call.body, {
    common_name: 'Червен мак', latin_name: 'Papaver rhoeas', family: null, photos: ['a.jpg'], confidence: 'Вероятно',
    recognition: null, habitat: null, lookalikes: null, benefits: null, risks: null, uses: null, fun_fact: null,
    author_email: 'editor@example.com', taxonomy_status: 'manual-unverified',
  });
});

test('an sb_secret_ server key is sent only as apikey', async () => {
  serviceEnv('sb_secret_test');
  const calls = mockFetch(json([{ id: PLANT_ID }], 201));
  await catalog.insertSupabasePlant({ commonName: 'А', latinName: 'B' }, EDITOR);
  assert.equal(calls[0].options.headers.apikey, 'sb_secret_test');
  assert.equal('authorization' in calls[0].options.headers, false);
});

test('without a server key the caller session is used, so RLS applies', async () => {
  useSupabaseEnv({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' });
  const calls = mockFetch(json([{ id: PLANT_ID }], 201));
  await catalog.insertSupabasePlant({ commonName: 'А', latinName: 'B' }, EDITOR);
  assert.equal(calls[0].options.headers.apikey, 'sb_publishable_test');
  assert.equal(calls[0].options.headers.authorization, 'Bearer user-access-token');
});

test('update patches only the provided fields and reports a missing plant as null', async () => {
  serviceEnv();
  const calls = mockFetch(json([{ id: PLANT_ID }]), json([]));

  assert.deepEqual(await catalog.updateSupabasePlant(PLANT_ID, { latinName: 'Papaver dubium', photos: ['x.jpg'], taxonomyStatus: 'editor-confirmed', family: '  ' }, EDITOR), { id: PLANT_ID });
  const [call] = calls;
  assert.equal(call.options.method, 'PATCH');
  assert.equal(call.url.searchParams.get('id'), `eq.${PLANT_ID}`);
  assert.equal(call.url.searchParams.get('select'), 'id');
  const { updated_at: updatedAt, ...fields } = call.body;
  assert.deepEqual(fields, { latin_name: 'Papaver dubium', family: null, photos: ['x.jpg'], taxonomy_status: 'editor-confirmed' });
  assert.ok(!Number.isNaN(Date.parse(updatedAt)));

  assert.equal(await catalog.updateSupabasePlant(PLANT_ID, { commonName: 'Мак' }, EDITOR), null);
});

test('delete and exists use the Data API and map empty results', async () => {
  serviceEnv();
  const calls = mockFetch(json([{ id: PLANT_ID }]), json([]), json([{ id: PLANT_ID }]), json([]));

  assert.deepEqual(await catalog.deleteSupabasePlant(PLANT_ID, EDITOR), { id: PLANT_ID });
  assert.equal(calls[0].options.method, 'DELETE');
  assert.equal(calls[0].url.searchParams.get('id'), `eq.${PLANT_ID}`);
  assert.equal(await catalog.deleteSupabasePlant(PLANT_ID, EDITOR), null);

  assert.equal(await catalog.supabasePlantExists(PLANT_ID, EDITOR), true);
  assert.equal(calls[2].options.method, 'GET');
  assert.equal(calls[2].url.searchParams.get('limit'), '1');
  assert.equal(await catalog.supabasePlantExists(PLANT_ID, EDITOR), false);
});

test('photo append re-reads and retries when a concurrent write changed the row', async () => {
  serviceEnv();
  const firstRead = { photos: ['placeholder.jpg'], updated_at: '2026-09-26T20:30:00.123456+00:00' };
  const secondRead = { photos: ['placeholder.jpg', 'https://example.supabase.co/other.jpg'], updated_at: '2026-09-26T20:30:01.5+00:00' };
  const newPhoto = 'https://example.supabase.co/storage/v1/object/public/plant-images/plants/p/new.jpg';
  const calls = mockFetch(
    json([firstRead]),
    json([]), // compare-and-set missed: the row changed in between
    json([secondRead]),
    json([{ id: PLANT_ID, photos: ['https://example.supabase.co/other.jpg', newPhoto] }]),
  );

  const updated = await catalog.appendSupabasePlantPhoto(PLANT_ID, newPhoto, EDITOR);

  assert.deepEqual(updated.photos, ['https://example.supabase.co/other.jpg', newPhoto]);
  assert.equal(calls.length, 4);
  assert.equal(calls[1].options.method, 'PATCH');
  // '+' must be percent-encoded, or the query string would turn it into a space.
  assert.match(calls[1].url.search, /updated_at=eq\.2026-09-26T20%3A30%3A00\.123456%2B00%3A00/);
  assert.deepEqual(calls[1].body.photos, [newPhoto]);
  assert.deepEqual(calls[3].body.photos, ['https://example.supabase.co/other.jpg', newPhoto]);
});

test('photo append reports a missing plant as null', async () => {
  serviceEnv();
  mockFetch(json([]));
  assert.equal(await catalog.appendSupabasePlantPhoto(PLANT_ID, 'https://example.supabase.co/a.jpg', EDITOR), null);
});

test('Data API failures carry codes the routes map to 503/403/400', async () => {
  serviceEnv();
  const input = { commonName: 'А', latinName: 'B' };
  const expectCode = async (code) => assert.rejects(catalog.insertSupabasePlant(input, EDITOR), (error) => error.code === code);

  mockFetch(() => { throw new TypeError('fetch failed'); });
  await expectCode('CATALOG_DATABASE_UNAVAILABLE');
  mockFetch(json({ message: 'upstream' }, 503));
  await expectCode('CATALOG_DATABASE_UNAVAILABLE');
  mockFetch(json({ code: '42501', message: 'new row violates row-level security policy' }, 403));
  await expectCode('CATALOG_ACCESS_DENIED');
  mockFetch(json({ code: '23514', message: 'violates check constraint' }, 400));
  await expectCode('CATALOG_INVALID_INPUT');

  useSupabaseEnv({});
  const calls = mockFetch(json([]));
  await expectCode('CATALOG_DATABASE_UNAVAILABLE');
  assert.equal(calls.length, 0, 'no request without a configured project');
});

test('input is validated before any request is sent', async () => {
  serviceEnv();
  const calls = mockFetch(json([]));
  await assert.rejects(catalog.updateSupabasePlant('not-a-uuid', { commonName: 'x' }, EDITOR), /Invalid plant id/);
  await assert.rejects(catalog.insertSupabasePlant({ latinName: 'B' }, EDITOR), /commonName is required/);
  await assert.rejects(catalog.insertSupabasePlant({ commonName: 'А', latinName: 'B', taxonomyStatus: 'verified' }, EDITOR), /Invalid taxonomy status/);
  // A filter smuggled into the id never reaches the Data API query string.
  await assert.rejects(catalog.deleteSupabasePlant(`${PLANT_ID}&id=neq.x`, EDITOR), /Invalid plant id/);
  assert.equal(calls.length, 0);
});

test('an empty Data API body (204) is treated as no rows, not a crash', async () => {
  serviceEnv();
  mockFetch(() => new Response(null, { status: 204 }));
  assert.equal(await catalog.insertSupabasePlant({ commonName: 'А', latinName: 'B' }, EDITOR), null);
  assert.equal(await catalog.updateSupabasePlant(PLANT_ID, { commonName: 'Мак' }, EDITOR), null);
  assert.equal(await catalog.deleteSupabasePlant(PLANT_ID, EDITOR), null);
  assert.equal(await catalog.supabasePlantExists(PLANT_ID, EDITOR), false);
  assert.equal(await catalog.appendSupabasePlantPhoto(PLANT_ID, 'https://example.supabase.co/a.jpg', EDITOR), null);
});

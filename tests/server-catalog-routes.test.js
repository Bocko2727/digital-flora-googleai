import test from 'node:test';
import assert from 'node:assert/strict';
import { useSupabaseEnv } from './support/isolated-supabase-env.js';

// The Express routes end to end, with no Postgres pool (as on Vercel with an
// unreachable SUPABASE_DB_URL): Supabase Auth, the Data API and Storage are
// mocked, requests to the local test server go to the real network stack.
delete process.env.VERCEL;
const { default: app } = await import('../server.js');

const PLANT_ID = '6ee821e7-f631-42d7-9a36-00a425c7a422';
const USER_ID = 'b3c7a0de-5a4f-4a9c-8f7e-2d1c9e0f1a2b';
const JPEG_DATA_URI = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString('base64')}`;
const originalFetch = globalThis.fetch;
const originalError = console.error;
let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

test.beforeEach(() => {
  useSupabaseEnv({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test' });
  console.error = () => {};
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  console.error = originalError;
});

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

// `handlers` maps "METHOD /path" of Supabase calls to response factories.
function mockSupabase({ role = 'editor', handlers = {} } = {}) {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.hostname === '127.0.0.1') return originalFetch(url, options);
    const method = options.method || 'GET';
    calls.push({ method, url: parsed, options, body: typeof options.body === 'string' ? JSON.parse(options.body) : options.body });
    if (parsed.pathname === '/auth/v1/user') return json({ id: USER_ID, email: 'editor@example.com' });
    if (parsed.pathname === '/rest/v1/profiles') return json([{ role }]);
    const handler = handlers[`${method} ${parsed.pathname}`] || (parsed.pathname.startsWith('/storage/v1/object/plant-images/') && handlers['POST storage']);
    if (handler) return handler(parsed, options);
    throw new Error(`unexpected Supabase request ${method} ${parsed.pathname}`);
  };
  return calls;
}

function api(path, { method = 'GET', body, token = 'user-access-token' } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  return fetch(`${baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

test('an editor can create a plant through the Data API fallback', async () => {
  const calls = mockSupabase({ handlers: { 'POST /rest/v1/plants': () => json([{ id: PLANT_ID }], 201) } });
  const response = await api('/api/plants', { method: 'POST', body: { commonName: 'Червен мак', latinName: 'Papaver rhoeas', photos: [] } });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { success: true, plant: { id: PLANT_ID } });
  const insert = calls.find((call) => call.method === 'POST' && call.url.pathname === '/rest/v1/plants');
  assert.equal(insert.body.author_email, 'editor@example.com');
  assert.equal(insert.options.headers.apikey, 'sb_secret_test');
});

test('whoami returns the role but never the access token', async () => {
  mockSupabase({ role: 'admin' });
  const response = await api('/api/auth/whoami');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { id: USER_ID, email: 'editor@example.com', role: 'admin' });
});

test('whoami is a 503 with a code when the role cannot be read', async () => {
  mockSupabase();
  globalThis.fetch = ((inner) => async (url, options) => (new URL(url).pathname === '/rest/v1/profiles' ? json({}, 502) : inner(url, options)))(globalThis.fetch);
  const response = await api('/api/auth/whoami');
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'CATALOG_AUTH_UNAVAILABLE');
});

test('an unavailable catalog database is a 503; an RLS denial is a 403', async () => {
  mockSupabase({ handlers: { 'PATCH /rest/v1/plants': () => json({ message: 'upstream' }, 503) } });
  let response = await api(`/api/plants/${PLANT_ID}`, { method: 'PUT', body: { commonName: 'Мак' } });
  assert.equal(response.status, 503);
  const unavailable = await response.json();
  assert.equal(unavailable.code, 'CATALOG_DATABASE_UNAVAILABLE');
  assert.match(unavailable.error, /временно не е достъпен/);

  mockSupabase({ handlers: { 'PATCH /rest/v1/plants': () => json({ code: '42501' }, 403) } });
  response = await api(`/api/plants/${PLANT_ID}`, { method: 'PUT', body: { commonName: 'Мак' } });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'CATALOG_WRITE_FORBIDDEN');
});

test('the server still refuses a delete by an editor before any Data API call', async () => {
  const calls = mockSupabase();
  const response = await api(`/api/plants/${PLANT_ID}`, { method: 'DELETE' });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'CATALOG_WRITE_FORBIDDEN');
  assert.equal(calls.some((call) => call.url.pathname === '/rest/v1/plants'), false);
});

test('a photo upload stores the image and attaches it through the Data API', async () => {
  const calls = mockSupabase({
    handlers: {
      'GET /rest/v1/plants': (url) => (url.searchParams.get('select') === 'id'
        ? json([{ id: PLANT_ID }])
        : json([{ photos: ['placeholder.jpg'], updated_at: '2026-09-26T20:30:00+00:00' }])),
      'POST storage': () => json({ Key: 'plant-images/plants/x.jpg' }),
      'PATCH /rest/v1/plants': (url, options) => json([{ id: PLANT_ID, photos: JSON.parse(options.body).photos }]),
    },
  });
  const response = await api(`/api/plants/${PLANT_ID}/photos`, { method: 'POST', body: { image: JPEG_DATA_URI } });
  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.match(payload.imageUrl, new RegExp(`^https://example\\.supabase\\.co/storage/v1/object/public/plant-images/plants/${PLANT_ID}/[0-9a-f-]+\\.jpg$`));
  assert.deepEqual(payload.plant.photos, [payload.imageUrl]);
  const upload = calls.find((call) => call.url.pathname.startsWith('/storage/v1/object/plant-images/'));
  assert.equal(upload.options.headers.apikey, 'sb_secret_test');
  assert.equal('authorization' in upload.options.headers, false, 'sb_secret_ keys are not bearer tokens');
  assert.equal(upload.options.headers['content-type'], 'image/jpeg');
});

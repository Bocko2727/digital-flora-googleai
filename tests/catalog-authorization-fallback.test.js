import test from 'node:test';
import assert from 'node:assert/strict';
import { useSupabaseEnv } from './support/isolated-supabase-env.js';

// No Postgres pool: the profile role must come from the Data API.
const { authenticateCatalogActor } = await import('../src/auth/catalog-authorization.js');

const USER_ID = 'b3c7a0de-5a4f-4a9c-8f7e-2d1c9e0f1a2b';
const originalFetch = globalThis.fetch;
const originalError = console.error;

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

// Routes Supabase Auth and Data API calls to separate handlers.
function mockSupabase({ auth = () => json({ id: USER_ID, email: 'editor@example.com' }), profiles = () => json([{ role: 'editor' }]) } = {}) {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const parsed = new URL(url);
    calls.push({ url: parsed, options });
    if (parsed.pathname === '/auth/v1/user') return auth();
    if (parsed.pathname === '/rest/v1/profiles') return profiles();
    throw new Error(`unexpected request ${parsed.pathname}`);
  };
  return calls;
}

async function authenticate(token = 'user-access-token') {
  const req = { get: (name) => (name.toLowerCase() === 'authorization' && token ? `Bearer ${token}` : undefined) };
  const res = { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  let nextCalls = 0;
  let nextError;
  await authenticateCatalogActor(req, res, (error) => { nextCalls += 1; nextError = error; });
  return { req, res, nextCalls, nextError };
}

test('reads the caller role through the Data API when there is no Postgres pool', async () => {
  const calls = mockSupabase();
  const { req, res, nextCalls, nextError } = await authenticate();

  assert.equal(nextCalls, 1);
  assert.equal(nextError, undefined);
  assert.equal(res.statusCode, null);
  assert.deepEqual(req.catalogActor, { id: USER_ID, email: 'editor@example.com', role: 'editor', accessToken: 'user-access-token' });
  const profileCall = calls.find((call) => call.url.pathname === '/rest/v1/profiles');
  assert.equal(profileCall.url.searchParams.get('id'), `eq.${USER_ID}`);
  assert.equal(profileCall.url.searchParams.get('select'), 'role');
  assert.deepEqual(profileCall.options.headers.apikey, 'sb_secret_test');
  assert.ok(calls[0].options.signal instanceof AbortSignal, 'the Auth call has a timeout');
});

test('without a server key the profile is read with the caller session', async () => {
  useSupabaseEnv({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' });
  const calls = mockSupabase();
  const { req } = await authenticate();
  const profileCall = calls.find((call) => call.url.pathname === '/rest/v1/profiles');
  assert.equal(profileCall.options.headers.apikey, 'sb_publishable_test');
  assert.equal(profileCall.options.headers.authorization, 'Bearer user-access-token');
  assert.equal(req.catalogActor.role, 'editor');
});

test('a missing profile row or unknown role is a viewer', async () => {
  mockSupabase({ profiles: () => json([]) });
  assert.equal((await authenticate()).req.catalogActor.role, 'viewer');
  mockSupabase({ profiles: () => json([{ role: 'superuser' }]) });
  assert.equal((await authenticate()).req.catalogActor.role, 'viewer');
});

test('an unreachable profile lookup is a 503, not an unhandled 500', async () => {
  mockSupabase({ profiles: () => json({ message: 'upstream' }, 500) });
  const { res, nextCalls } = await authenticate();
  assert.equal(nextCalls, 0);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'CATALOG_AUTH_UNAVAILABLE');
});

test('Supabase Auth outages are a 503; an invalid token stays a 401', async () => {
  mockSupabase({ auth: () => json({ msg: 'unavailable' }, 503) });
  assert.equal((await authenticate()).res.body.code, 'CATALOG_AUTH_UNAVAILABLE');
  mockSupabase({ auth: () => { throw new TypeError('fetch failed'); } });
  assert.equal((await authenticate()).res.statusCode, 503);
  mockSupabase({ auth: () => json({ error_code: 'bad_jwt' }, 403) });
  const expired = await authenticate();
  assert.equal(expired.res.statusCode, 401);
  assert.equal(expired.res.body.code, 'UNAUTHENTICATED');
});

test('no token is a 401 and missing configuration a 503, without any request', async () => {
  const calls = mockSupabase();
  const anonymous = await authenticate(null);
  assert.equal(anonymous.res.statusCode, 401);
  useSupabaseEnv({});
  const unconfigured = await authenticate();
  assert.equal(unconfigured.res.statusCode, 503);
  assert.equal(unconfigured.res.body.code, 'SUPABASE_AUTH_NOT_CONFIGURED');
  assert.equal(calls.length, 0);
});

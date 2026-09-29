import test from 'node:test';
import assert from 'node:assert/strict';
import { useSupabaseEnv } from './support/isolated-supabase-env.js';

// A real pg pool pointed at a closed local port: every connect fails with
// ECONNREFUSED before any SQL is sent, like the ENOTFOUND on Vercel.
process.env.SUPABASE_DB_URL = 'postgres://postgres:placeholder@127.0.0.1:1/postgres';
const { default: pool, getUsablePool } = await import('../src/db/supabase.js');
const catalog = await import('../src/db/supabase-catalog.js');

const PLANT_ID = '6ee821e7-f631-42d7-9a36-00a425c7a422';
const EDITOR = { id: 'b3c7a0de-5a4f-4a9c-8f7e-2d1c9e0f1a2b', email: 'editor@example.com', role: 'editor', accessToken: 'user-access-token' };
const originalFetch = globalThis.fetch;
const originalQuery = pool.query;
const originalError = console.error;

test.beforeEach(() => {
  useSupabaseEnv({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test' });
  console.error = () => {};
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  pool.query = originalQuery;
  console.error = originalError;
});

test.after(() => pool.end());

function mockFetch(body, status = 200) {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: new URL(url), options });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  return calls;
}

function failingQuery(fields) {
  return async () => { throw Object.assign(new Error(fields.message || 'query failed'), fields); };
}

test('a write that failed after reaching Postgres is not repeated through the Data API', async () => {
  pool.query = failingQuery({ code: '23514', message: 'new row violates check constraint "plants_taxonomy_status_check"' });
  const calls = mockFetch([{ id: PLANT_ID }], 201);
  await assert.rejects(catalog.insertSupabasePlant({ commonName: 'А', latinName: 'B' }, EDITOR), (error) => error.code === '23514');
  assert.equal(calls.length, 0);
  assert.equal(getUsablePool(), pool, 'a statement error does not pause the pool');
});

test('a read retries any Postgres failure through the Data API', async () => {
  pool.query = failingQuery({ code: '42501', message: 'permission denied for table plants' });
  const calls = mockFetch([{ id: PLANT_ID }]);
  assert.equal(await catalog.supabasePlantExists(PLANT_ID, EDITOR), true);
  assert.equal(calls.length, 1);
  assert.equal(getUsablePool(), pool);
});

test('a connection failure sends the write through the Data API and pauses the pool', async () => {
  const calls = mockFetch([{ id: PLANT_ID }], 201);
  assert.deepEqual(await catalog.insertSupabasePlant({ commonName: 'А', latinName: 'B' }, EDITOR), { id: PLANT_ID });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(getUsablePool(), null, 'the failing pool is skipped for the cooldown');
});

test('while the pool is paused, operations go straight to the Data API', async () => {
  let poolQueries = 0;
  pool.query = async (...args) => { poolQueries += 1; return originalQuery.apply(pool, args); };
  const calls = mockFetch([{ id: PLANT_ID }]);
  assert.deepEqual(await catalog.updateSupabasePlant(PLANT_ID, { commonName: 'Мак' }, EDITOR), { id: PLANT_ID });
  assert.equal(poolQueries, 0);
  assert.equal(calls.length, 1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import './support/isolated-supabase-env.js';

// The static-asset limiter must count each request once. The missing-image
// fallback used to be a path-less app.use() with its own copy of the limiter,
// so "/" cost two units and /health one: a full Playwright run (one client IP)
// exhausted the 600-request budget and the last specs got a 429 page.
delete process.env.VERCEL;
const { default: app } = await import('../server.js');

const originalFetch = globalThis.fetch;
let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

async function remainingAfter(path) {
  const response = await fetch(`${baseUrl}${path}`);
  await response.arrayBuffer();
  assert.equal(response.status, 200, path);
  const remaining = response.headers.get('ratelimit-remaining');
  assert.ok(remaining !== null, `${path} has no RateLimit-Remaining header`);
  return Number(remaining);
}

test('GET / costs one unit of the static-asset budget', async () => {
  const first = await remainingAfter('/');
  const second = await remainingAfter('/');
  assert.equal(first - second, 1);
});

test('GET /health does not spend the static-asset budget', async () => {
  const before = await remainingAfter('/');
  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
  const after = await remainingAfter('/');
  assert.equal(before - after, 1);
});

test('a missing image still gets the rate-limited placeholder', async () => {
  // The fallback looks the file up on raw.githubusercontent.com; keep it offline.
  globalThis.fetch = async (url, options) => {
    if (new URL(url).hostname === '127.0.0.1') return originalFetch(url, options);
    return new Response('not found', { status: 404 });
  };
  const response = await fetch(`${baseUrl}/no-such-photo-ratelimit-test.jpg`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^image\/svg\+xml/);
  assert.ok(response.headers.get('ratelimit-remaining') !== null);
  assert.match(await response.text(), /Снимката липсва/);
});
